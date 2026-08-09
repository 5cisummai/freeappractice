import { randomUUID } from 'node:crypto';
import { asc, eq, inArray } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
	FrqQuestionSchema,
	type FrqGrade,
	type FrqMaterial,
	type FrqRubricCriterion,
	type FrqSection,
	type FrqQuestion
} from '$lib/frq/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	frqAttemptCriterionGrades,
	frqAttemptGrades,
	frqAttempts,
	frqMaterials,
	frqQuestions,
	frqRubricCriteria,
	frqRubricLevels,
	frqSections,
	questionRecentTopics,
	questionRegistry
} from '$lib/server/neon/schema';
import {
	applyProjection,
	model,
	PostgresQuery,
	type Projection,
	type SortSpec,
	type WriteResult
} from '$lib/server/neon/model';

type DocumentFields = { _id: string; save: () => Promise<unknown> };

export interface IFrqQuestion extends DocumentFields {
	apClass: string;
	unit: string;
	formatId: string;
	profileVersion: string;
	promptVersion: string;
	rubricVersion: string;
	schemaVersion: 1;
	prompt: string;
	materials: FrqMaterial[];
	sections: FrqSection[];
	rubric: FrqRubricCriterion[];
	totalPoints: number;
	topicsCovered: string;
	contentHash: string;
	questionId: string;
	randomKey: number;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export function newFrqPoolRandomKey(): number {
	return Math.random();
}

export function toFrqQuestion(doc: IFrqQuestion): FrqQuestion {
	return FrqQuestionSchema.parse({
		schemaVersion: doc.schemaVersion,
		formatId: doc.formatId,
		profileVersion: doc.profileVersion,
		promptVersion: doc.promptVersion,
		rubricVersion: doc.rubricVersion,
		prompt: doc.prompt,
		materials: doc.materials,
		sections: doc.sections,
		rubric: doc.rubric,
		totalPoints: doc.totalPoints,
		topicsCovered: doc.topicsCovered,
		apClass: doc.apClass,
		unit: doc.unit
	});
}

export interface IFrqAttempt extends DocumentFields {
	userId: string;
	submissionId: string;
	questionId: string;
	apClass: string;
	unit: string;
	formatId: string;
	responses: Record<string, string>;
	status: 'grading' | 'graded';
	grade?: FrqGrade;
	timeTakenMs: number;
	profileVersion: string;
	rubricVersion: string;
	promptVersion: string;
	gradingModel?: string;
	createdAt: Date;
	updatedAt: Date;
}

const frqBase = model<IFrqQuestion>({
	table: frqQuestions as any,
	columns: frqQuestions as any,
	idField: 'questionId',
	fromRow: (row) => ({
		...(row as unknown as IFrqQuestion),
		_id: String((row as { questionId: string }).questionId),
		materials: [],
		sections: [],
		rubric: []
	})
});

function groupRowsByQuestion(
	rows: Array<Record<string, any>>
): Map<string, Array<Record<string, any>>> {
	const grouped = new Map<string, Array<Record<string, any>>>();
	for (const row of rows) {
		const list = grouped.get(row.questionId) ?? [];
		list.push(row);
		grouped.set(row.questionId, list);
	}
	return grouped;
}

async function hydrateFrqQuestions(rows: IFrqQuestion[]): Promise<IFrqQuestion[]> {
	if (!rows.length) return [];

	const db = getNeonDatabase() as any;
	const questionIds = [...new Set(rows.map((row) => row.questionId))];
	const [materials, sections, criteria, levels] = await Promise.all([
		db
			.select()
			.from(frqMaterials as any)
			.where(inArray((frqMaterials as any).questionId, questionIds))
			.orderBy(asc((frqMaterials as any).position)),
		db
			.select()
			.from(frqSections as any)
			.where(inArray((frqSections as any).questionId, questionIds))
			.orderBy(asc((frqSections as any).position)),
		db
			.select()
			.from(frqRubricCriteria as any)
			.where(inArray((frqRubricCriteria as any).questionId, questionIds))
			.orderBy(asc((frqRubricCriteria as any).position)),
		db
			.select()
			.from(frqRubricLevels as any)
			.where(inArray((frqRubricLevels as any).questionId, questionIds))
			.orderBy(asc((frqRubricLevels as any).position))
	]);
	const materialsByQuestion = groupRowsByQuestion(materials as Array<Record<string, any>>);
	const sectionsByQuestion = groupRowsByQuestion(sections as Array<Record<string, any>>);
	const criteriaByQuestion = groupRowsByQuestion(criteria as Array<Record<string, any>>);
	const levelsByQuestion = groupRowsByQuestion(levels as Array<Record<string, any>>);

	return rows.map((row) => {
		const questionId = row.questionId;
		const rubricLevels = levelsByQuestion.get(questionId) ?? [];
		const document: IFrqQuestion = {
			...row,
			materials: (materialsByQuestion.get(questionId) ?? []).map((item) => ({
				id: item.materialId,
				title: item.title ?? undefined,
				content: item.content
			})),
			sections: (sectionsByQuestion.get(questionId) ?? []).map((item) => ({
				id: item.sectionId,
				label: item.label,
				prompt: item.prompt,
				responseKind: item.responseKind,
				maxPoints: item.maxPoints
			})),
			rubric: (criteriaByQuestion.get(questionId) ?? []).map((item) => ({
				id: item.criterionId,
				sectionId: item.sectionId,
				label: item.label,
				maxPoints: item.maxPoints,
				referenceAnswer: item.referenceAnswer,
				levels: rubricLevels
					.filter((level) => level.criterionId === item.criterionId)
					.map((level) => ({ points: level.points, description: level.description }))
			})),
			save: async () => document
		};
		return document;
	});
}

async function hydrateFrqQuestion(row: IFrqQuestion): Promise<IFrqQuestion> {
	return (await hydrateFrqQuestions([row]))[0];
}

export const FrqQuestionModel = {
	find(
		filter: Record<string, unknown> = {},
		projection?: Projection,
		options?: { sort?: SortSpec; limit?: number }
	): PostgresQuery<IFrqQuestion[]> {
		return new PostgresQuery(async (queryOptions) => {
			const rows = await frqBase
				.find(filter, undefined, {
					sort: queryOptions.sort ?? options?.sort,
					limit: queryOptions.limit ?? options?.limit
				})
				.exec();
			const hydrated = await hydrateFrqQuestions(rows);
			return hydrated.map((row) => applyProjection(row, queryOptions.projection ?? projection));
		});
	},
	findOne(
		filter: Record<string, unknown> = {},
		projection?: Projection | null,
		options?: { sort?: SortSpec }
	): PostgresQuery<IFrqQuestion | null> {
		return new PostgresQuery(async (queryOptions) => {
			const row = await frqBase.findOne(filter, undefined, options).exec();
			return row
				? applyProjection(
						await hydrateFrqQuestion(row),
						queryOptions.projection ?? projection ?? undefined
					)
				: null;
		});
	},
	async create(input: {
		questionId?: string;
		apClass: string;
		unit: string;
		formatId: string;
		profileVersion: string;
		promptVersion: string;
		rubricVersion: string;
		schemaVersion?: 1;
		prompt: string;
		materials?: FrqMaterial[];
		sections?: FrqSection[];
		rubric?: FrqRubricCriterion[];
		totalPoints: number;
		topicsCovered: string;
		contentHash: string;
		randomKey?: number;
		active?: boolean;
		createdAt?: Date;
		updatedAt?: Date;
	}): Promise<IFrqQuestion> {
		const db = getNeonDatabase();
		const questionId = String(input.questionId ?? '');
		if (!questionId) throw new Error('FRQ question requires questionId');
		const createdAt = input.createdAt ?? new Date();
		const updatedAt = input.updatedAt ?? createdAt;

		const registryInsert = db
			.insert(questionRegistry)
			.values({
				questionId,
				kind: 'frq',
				apClass: input.apClass,
				unit: input.unit,
				contentHash: input.contentHash,
				questionCreatedAt: createdAt,
				contentLength: String(input.prompt ?? '').length,
				createdAt,
				updatedAt
			})
			.onConflictDoUpdate({
				target: questionRegistry.questionId,
				set: {
					kind: 'frq',
					apClass: input.apClass,
					unit: input.unit,
					contentHash: input.contentHash,
					updatedAt
				}
			});
		const questionInsert = db
			.insert(frqQuestions)
			.values({
				questionId,
				apClass: input.apClass,
				unit: input.unit,
				formatId: input.formatId,
				profileVersion: input.profileVersion,
				promptVersion: input.promptVersion,
				rubricVersion: input.rubricVersion,
				schemaVersion: input.schemaVersion ?? 1,
				prompt: input.prompt,
				totalPoints: input.totalPoints,
				topicsCovered: input.topicsCovered,
				contentHash: input.contentHash,
				randomKey: input.randomKey ?? newFrqPoolRandomKey(),
				active: input.active ?? true,
				createdAt,
				updatedAt
			})
			.onConflictDoUpdate({
				target: frqQuestions.questionId,
				set: {
					apClass: input.apClass,
					unit: input.unit,
					formatId: input.formatId,
					profileVersion: input.profileVersion,
					promptVersion: input.promptVersion,
					rubricVersion: input.rubricVersion,
					schemaVersion: input.schemaVersion ?? 1,
					prompt: input.prompt,
					totalPoints: input.totalPoints,
					topicsCovered: input.topicsCovered,
					contentHash: input.contentHash,
					randomKey: input.randomKey ?? newFrqPoolRandomKey(),
					active: input.active ?? true,
					updatedAt
				}
			});

		// Keep the registry, parent, and child replacement writes atomic in Neon.
		const writes: [BatchItem<'pg'>, ...BatchItem<'pg'>[]] = [
			registryInsert,
			questionInsert,
			db.delete(frqMaterials).where(eq(frqMaterials.questionId, questionId)),
			db.delete(frqSections).where(eq(frqSections.questionId, questionId)),
			db.delete(frqRubricCriteria).where(eq(frqRubricCriteria.questionId, questionId)),
			db.delete(frqRubricLevels).where(eq(frqRubricLevels.questionId, questionId))
		];

		if (input.materials?.length) {
			writes.push(
				db.insert(frqMaterials).values(
					input.materials.map((item, position) => ({
						questionId,
						materialId: item.id,
						title: item.title ?? null,
						content: item.content,
						position
					}))
				)
			);
		}

		if (input.sections?.length) {
			writes.push(
				db.insert(frqSections).values(
					input.sections.map((item, position) => ({
						questionId,
						sectionId: item.id,
						label: item.label,
						prompt: item.prompt,
						responseKind: item.responseKind,
						maxPoints: item.maxPoints,
						position
					}))
				)
			);
		}

		if (input.rubric?.length) {
			writes.push(
				db.insert(frqRubricCriteria).values(
					input.rubric.map((item, position) => ({
						questionId,
						criterionId: item.id,
						sectionId: item.sectionId,
						label: item.label,
						maxPoints: item.maxPoints,
						referenceAnswer: item.referenceAnswer,
						position
					}))
				)
			);

			const levelRows = input.rubric.flatMap((item) =>
				item.levels.map((level, position) => ({
					questionId,
					criterionId: item.id,
					points: level.points,
					description: level.description,
					position
				}))
			);
			if (levelRows.length) {
				writes.push(db.insert(frqRubricLevels).values(levelRows));
			}
		}

		const topicsCovered = input.topicsCovered.trim();
		if (topicsCovered) {
			writes.push(
				db.insert(questionRecentTopics).values({
					id: randomUUID(),
					kind: 'frq',
					apClass: input.apClass,
					unit: input.unit,
					topicsCovered,
					questionId
				})
			);
		}

		await db.batch(writes);

		const row = await frqBase.findOne({ _id: questionId }).exec();
		if (!row) throw new Error('FRQ question was not created');
		return hydrateFrqQuestion(row);
	}
};

const frqAttemptBase = model<IFrqAttempt>({
	table: frqAttempts as any,
	columns: frqAttempts as any,
	idField: 'id',
	prepareInsert: async (input) => ({ ...input, id: input.id ?? randomUUID() })
});

async function hydrateAttempts(rows: IFrqAttempt[]): Promise<IFrqAttempt[]> {
	if (!rows.length) return [];

	const db = getNeonDatabase() as any;
	const attemptIds = [...new Set(rows.map((row) => row._id))];
	const [gradeRows, criterionRows] = await Promise.all([
		db
			.select()
			.from(frqAttemptGrades as any)
			.where(inArray((frqAttemptGrades as any).attemptId, attemptIds)),
		db
			.select()
			.from(frqAttemptCriterionGrades as any)
			.where(inArray((frqAttemptCriterionGrades as any).attemptId, attemptIds))
	]);
	const gradesByAttempt = new Map(
		(gradeRows as Array<Record<string, any>>).map((grade) => [grade.attemptId, grade])
	);
	const criteriaByAttempt = new Map<string, Array<Record<string, any>>>();
	for (const criterion of criterionRows as Array<Record<string, any>>) {
		const list = criteriaByAttempt.get(criterion.attemptId) ?? [];
		list.push(criterion);
		criteriaByAttempt.set(criterion.attemptId, list);
	}

	return rows.map((row) => {
		const grade = gradesByAttempt.get(row._id);
		const document: IFrqAttempt = {
			...row,
			grade: grade
				? {
						criteria: (criteriaByAttempt.get(row._id) ?? []).map((item) => ({
							criterionId: item.criterionId,
							sectionId: item.sectionId,
							label: item.label,
							points: item.points,
							pointsAvailable: item.pointsAvailable,
							evidence: item.evidence,
							feedback: item.feedback
						})),
						pointsEarned: grade.pointsEarned,
						pointsAvailable: grade.pointsAvailable,
						percentage: grade.percentage,
						overallFeedback: grade.overallFeedback
					}
				: undefined,
			save: async () => {
				const writes = [
					db
						.update(frqAttempts as any)
						.set({
							userId: document.userId,
							submissionId: document.submissionId,
							questionId: document.questionId,
							apClass: document.apClass,
							unit: document.unit,
							formatId: document.formatId,
							responses: document.responses,
							status: document.status,
							timeTakenMs: document.timeTakenMs,
							profileVersion: document.profileVersion,
							rubricVersion: document.rubricVersion,
							promptVersion: document.promptVersion,
							gradingModel: document.gradingModel ?? null,
							updatedAt: document.updatedAt
						})
						.where(eq((frqAttempts as any).id, document._id)),
					db
						.delete(frqAttemptGrades as any)
						.where(eq((frqAttemptGrades as any).attemptId, document._id)),
					db
						.delete(frqAttemptCriterionGrades as any)
						.where(eq((frqAttemptCriterionGrades as any).attemptId, document._id))
				];
				if (document.grade) {
					writes.push(
						db.insert(frqAttemptGrades as any).values({
							attemptId: document._id,
							pointsEarned: document.grade.pointsEarned,
							pointsAvailable: document.grade.pointsAvailable,
							percentage: document.grade.percentage,
							overallFeedback: document.grade.overallFeedback
						})
					);
					if (document.grade.criteria.length)
						writes.push(
							db
								.insert(frqAttemptCriterionGrades as any)
								.values(
									document.grade.criteria.map((item) => ({ attemptId: document._id, ...item }))
								)
						);
				}
				await db.batch(writes);
				return document;
			}
		};
		return document;
	});
}

async function hydrateAttempt(row: IFrqAttempt): Promise<IFrqAttempt> {
	return (await hydrateAttempts([row]))[0];
}

export const FrqAttempt = {
	find(
		filter: Record<string, unknown> = {},
		projection?: Projection
	): PostgresQuery<IFrqAttempt[]> {
		return new PostgresQuery(async (options) => {
			const sqlFilter = Object.fromEntries(
				Object.entries(filter).filter(([key]) => !key.startsWith('grade.'))
			);
			const rows = await frqAttemptBase.find(sqlFilter).exec();
			const hydrated = await hydrateAttempts(rows);
			const filtered = hydrated.filter((row) => {
				const percentage = filter['grade.percentage'];
				if (percentage === undefined) return true;
				if (!row.grade) return false;
				if (typeof percentage === 'object' && percentage !== null && '$exists' in percentage) {
					return (
						Boolean((percentage as { $exists?: unknown }).$exists) ===
						(row.grade.percentage !== undefined)
					);
				}
				return row.grade.percentage === percentage;
			});
			return filtered.map((row) => applyProjection(row, options.projection ?? projection));
		});
	},
	findOne(
		filter: Record<string, unknown> = {},
		projection?: Projection
	): PostgresQuery<IFrqAttempt | null> {
		return new PostgresQuery(async (options) => {
			const row = await frqAttemptBase.findOne(filter).exec();
			return row
				? applyProjection(await hydrateAttempt(row), options.projection ?? projection)
				: null;
		});
	},
	async create(input: Record<string, any>): Promise<IFrqAttempt> {
		const row = await frqAttemptBase.create(input);
		return hydrateAttempt(row);
	},
	deleteOne(filter: Record<string, unknown>): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => frqAttemptBase.deleteOne(filter).exec());
	},
	deleteMany(filter: Record<string, unknown>): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => frqAttemptBase.deleteMany(filter).exec());
	}
};
