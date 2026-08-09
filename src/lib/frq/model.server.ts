import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
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

export interface IFrqRecentTopic extends DocumentFields {
	apClass: string;
	unit: string;
	topicsCovered: string;
	questionId: string;
	createdAt: Date;
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

async function hydrateFrqQuestion(row: IFrqQuestion): Promise<IFrqQuestion> {
	const db = getNeonDatabase() as any;
	const questionId = row.questionId;
	const [materials, sections, criteria, levels] = await Promise.all([
		db
			.select()
			.from(frqMaterials as any)
			.where(eq((frqMaterials as any).questionId, questionId))
			.orderBy(asc((frqMaterials as any).position)),
		db
			.select()
			.from(frqSections as any)
			.where(eq((frqSections as any).questionId, questionId))
			.orderBy(asc((frqSections as any).position)),
		db
			.select()
			.from(frqRubricCriteria as any)
			.where(eq((frqRubricCriteria as any).questionId, questionId))
			.orderBy(asc((frqRubricCriteria as any).position)),
		db
			.select()
			.from(frqRubricLevels as any)
			.where(eq((frqRubricLevels as any).questionId, questionId))
			.orderBy(asc((frqRubricLevels as any).position))
	]);
	const levelsByCriterion = new Map<string, Array<Record<string, any>>>();
	for (const level of levels as Array<Record<string, any>>) {
		const list = levelsByCriterion.get(level.criterionId) ?? [];
		list.push(level);
		levelsByCriterion.set(level.criterionId, list);
	}
	const document: IFrqQuestion = {
		...row,
		materials: (materials as Array<Record<string, any>>).map((item) => ({
			id: item.materialId,
			title: item.title ?? undefined,
			content: item.content
		})),
		sections: (sections as Array<Record<string, any>>).map((item) => ({
			id: item.sectionId,
			label: item.label,
			prompt: item.prompt,
			responseKind: item.responseKind,
			maxPoints: item.maxPoints
		})),
		rubric: (criteria as Array<Record<string, any>>).map((item) => ({
			id: item.criterionId,
			sectionId: item.sectionId,
			label: item.label,
			maxPoints: item.maxPoints,
			referenceAnswer: item.referenceAnswer,
			levels: (levelsByCriterion.get(item.criterionId) ?? []).map((level) => ({
				points: level.points,
				description: level.description
			}))
		})),
		save: async () => document
	};
	return document;
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
			const hydrated = await Promise.all(rows.map(hydrateFrqQuestion));
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
	countDocuments(filter: Record<string, unknown> = {}): PostgresQuery<number> {
		return frqBase.countDocuments(filter);
	},
	updateMany(
		filter: Record<string, unknown>,
		update: Record<string, unknown>
	): PostgresQuery<WriteResult> {
		return new PostgresQuery(async () => frqBase.updateMany(filter, update).exec());
	},
	async create(input: Record<string, any>): Promise<IFrqQuestion> {
		const db = getNeonDatabase() as any;
		const questionId = String(input.questionId ?? '');
		if (!questionId) throw new Error('FRQ question requires questionId');
		const createdAt = input.createdAt ?? new Date();
		const updatedAt = input.updatedAt ?? createdAt;
		await db
			.insert(questionRegistry as any)
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
				target: (questionRegistry as any).questionId,
				set: {
					kind: 'frq',
					apClass: input.apClass,
					unit: input.unit,
					contentHash: input.contentHash,
					updatedAt
				}
			});
		await db
			.insert(frqQuestions as any)
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
			.onConflictDoNothing();
		await db.delete(frqMaterials as any).where(eq((frqMaterials as any).questionId, questionId));
		await db.delete(frqSections as any).where(eq((frqSections as any).questionId, questionId));
		await db
			.delete(frqRubricCriteria as any)
			.where(eq((frqRubricCriteria as any).questionId, questionId));
		await db
			.delete(frqRubricLevels as any)
			.where(eq((frqRubricLevels as any).questionId, questionId));
		if (input.materials?.length)
			await db.insert(frqMaterials as any).values(
				input.materials.map((item: FrqMaterial, position: number) => ({
					questionId,
					materialId: item.id,
					title: item.title ?? null,
					content: item.content,
					position
				}))
			);
		if (input.sections?.length)
			await db.insert(frqSections as any).values(
				input.sections.map((item: FrqSection, position: number) => ({
					questionId,
					sectionId: item.id,
					label: item.label,
					prompt: item.prompt,
					responseKind: item.responseKind,
					maxPoints: item.maxPoints,
					position
				}))
			);
		if (input.rubric?.length) {
			await db.insert(frqRubricCriteria as any).values(
				input.rubric.map((item: FrqRubricCriterion, position: number) => ({
					questionId,
					criterionId: item.id,
					sectionId: item.sectionId,
					label: item.label,
					maxPoints: item.maxPoints,
					referenceAnswer: item.referenceAnswer,
					position
				}))
			);
			const levelRows = input.rubric.flatMap((item: FrqRubricCriterion) =>
				item.levels.map((level, position: number) => ({
					questionId,
					criterionId: item.id,
					points: level.points,
					description: level.description,
					position
				}))
			);
			if (levelRows.length) await db.insert(frqRubricLevels as any).values(levelRows);
		}
		const row = await frqBase.findOne({ _id: questionId }).exec();
		if (!row) throw new Error('FRQ question was not created');
		return hydrateFrqQuestion(row);
	}
};

const frqRecentBase = model<IFrqRecentTopic>({
	table: questionRecentTopics as any,
	columns: questionRecentTopics as any,
	idField: 'id',
	prepareInsert: async (input) => ({
		...input,
		id: input.id ?? randomUUID(),
		kind: 'frq',
		questionId: input.questionId
	})
});

export const FrqRecentTopic = frqRecentBase;

const frqAttemptBase = model<IFrqAttempt>({
	table: frqAttempts as any,
	columns: frqAttempts as any,
	idField: 'id',
	prepareInsert: async (input) => ({ ...input, id: input.id ?? randomUUID() })
});

async function hydrateAttempt(row: IFrqAttempt): Promise<IFrqAttempt> {
	const db = getNeonDatabase() as any;
	const grade = (
		await db
			.select()
			.from(frqAttemptGrades as any)
			.where(eq((frqAttemptGrades as any).attemptId, row._id))
			.limit(1)
	)[0] as Record<string, any> | undefined;
	const criteria = await db
		.select()
		.from(frqAttemptCriterionGrades as any)
		.where(eq((frqAttemptCriterionGrades as any).attemptId, row._id));
	const document: IFrqAttempt = {
		...row,
		grade: grade
			? {
					criteria: (criteria as Array<Record<string, any>>).map((item) => ({
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
			await frqAttemptBase
				.updateOne({ _id: document._id }, { $set: { ...document, grade: undefined } })
				.exec();
			await db
				.delete(frqAttemptGrades as any)
				.where(eq((frqAttemptGrades as any).attemptId, document._id));
			await db
				.delete(frqAttemptCriterionGrades as any)
				.where(eq((frqAttemptCriterionGrades as any).attemptId, document._id));
			if (document.grade) {
				await db.insert(frqAttemptGrades as any).values({
					attemptId: document._id,
					pointsEarned: document.grade.pointsEarned,
					pointsAvailable: document.grade.pointsAvailable,
					percentage: document.grade.percentage,
					overallFeedback: document.grade.overallFeedback
				});
				if (document.grade.criteria.length)
					await db
						.insert(frqAttemptCriterionGrades as any)
						.values(document.grade.criteria.map((item) => ({ attemptId: document._id, ...item })));
			}
			return document;
		}
	};
	return document;
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
			const hydrated = await Promise.all(rows.map(hydrateAttempt));
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
	},
	aggregate<T = Record<string, unknown>>(pipeline: unknown[]): PostgresQuery<T[]> {
		return new PostgresQuery(async () => {
			const firstStage =
				Array.isArray(pipeline) && pipeline[0] && typeof pipeline[0] === 'object'
					? (pipeline[0] as { $match?: Record<string, unknown> })
					: {};
			const rows = await this.find(firstStage.$match ?? { status: 'graded' }).exec();
			const grouped = new Map<
				string,
				{
					apClass: string;
					unit: string;
					attempts: number;
					pointsEarned: number;
					pointsAvailable: number;
					lastAttemptAt?: Date;
				}
			>();
			for (const row of rows) {
				if (!row.grade) continue;
				const key = `${row.apClass}\u0000${row.unit}`;
				const current = grouped.get(key) ?? {
					apClass: row.apClass,
					unit: row.unit,
					attempts: 0,
					pointsEarned: 0,
					pointsAvailable: 0
				};
				current.attempts += 1;
				current.pointsEarned += row.grade.pointsEarned;
				current.pointsAvailable += row.grade.pointsAvailable;
				if (!current.lastAttemptAt || row.createdAt > current.lastAttemptAt)
					current.lastAttemptAt = row.createdAt;
				grouped.set(key, current);
			}
			return [...grouped.values()].map((row) => ({
				_id: { apClass: row.apClass, unit: row.unit },
				attempts: row.attempts,
				pointsEarned: row.pointsEarned,
				pointsAvailable: row.pointsAvailable,
				lastAttemptAt: row.lastAttemptAt
			})) as T[];
		});
	}
};
