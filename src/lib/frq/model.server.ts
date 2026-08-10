import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lt, ne, notInArray } from 'drizzle-orm';
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
export interface IFrqQuestion {
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

export interface IFrqAttempt {
	id: string;
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

function frqQuestionRow(row: typeof frqQuestions.$inferSelect): IFrqQuestion {
	return { ...row, schemaVersion: row.schemaVersion as 1, materials: [], sections: [], rubric: [] };
}

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
			}))
		};
		return document;
	});
}

async function hydrateFrqQuestion(row: IFrqQuestion): Promise<IFrqQuestion> {
	return (await hydrateFrqQuestions([row]))[0];
}

export async function findFrqQuestionByPool(input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	fromPivot: 'after' | 'before';
	onDatabaseInit?: (elapsedMs: number) => void;
}): Promise<IFrqQuestion | null> {
	const predicates = [
		eq(frqQuestions.apClass, input.apClass),
		eq(frqQuestions.unit, input.unit),
		ne(frqQuestions.active, false),
		input.fromPivot === 'after'
			? gte(frqQuestions.randomKey, input.pivot)
			: lt(frqQuestions.randomKey, input.pivot)
	];
	if (input.excludeQuestionIds.length)
		predicates.push(notInArray(frqQuestions.questionId, input.excludeQuestionIds));
	const rows = await getNeonDatabase(input.onDatabaseInit)
		.select()
		.from(frqQuestions)
		.where(and(...predicates))
		.orderBy(frqQuestions.randomKey)
		.limit(1);
	return rows[0] ? hydrateFrqQuestion(frqQuestionRow(rows[0])) : null;
}

export async function findFrqQuestionById(questionId: string): Promise<IFrqQuestion | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqQuestions)
		.where(eq(frqQuestions.questionId, questionId))
		.limit(1);
	return rows[0] ? hydrateFrqQuestion(frqQuestionRow(rows[0])) : null;
}

export async function createFrqQuestion(input: {
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

	const rows = await db
		.select()
		.from(frqQuestions)
		.where(eq(frqQuestions.questionId, questionId))
		.limit(1);
	const row = rows[0] ? frqQuestionRow(rows[0]) : null;
	if (!row) throw new Error('FRQ question was not created');
	return hydrateFrqQuestion(row);
}

async function hydrateAttempts(rows: IFrqAttempt[]): Promise<IFrqAttempt[]> {
	if (!rows.length) return [];

	const db = getNeonDatabase();
	const attemptIds = [...new Set(rows.map((row) => row.id))];
	const [gradeRows, criterionRows] = await Promise.all([
		db.select().from(frqAttemptGrades).where(inArray(frqAttemptGrades.attemptId, attemptIds)),
		db
			.select()
			.from(frqAttemptCriterionGrades)
			.where(inArray(frqAttemptCriterionGrades.attemptId, attemptIds))
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
		const grade = gradesByAttempt.get(row.id);
		const document: IFrqAttempt = {
			...row,
			grade: grade
				? {
						criteria: (criteriaByAttempt.get(row.id) ?? []).map((item) => ({
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
				: undefined
		};
		return document;
	});
}

export async function createFrqAttempt(
	input: Omit<IFrqAttempt, 'id' | 'createdAt' | 'updatedAt' | 'grade'>
): Promise<IFrqAttempt> {
	const rows = await getNeonDatabase()
		.insert(frqAttempts)
		.values({ id: randomUUID(), ...input })
		.returning();
	if (!rows[0]) throw new Error('FRQ attempt insert returned no row');
	return (await hydrateAttempts([rows[0] as IFrqAttempt]))[0];
}

export async function findFrqAttemptBySubmission(
	userId: string,
	submissionId: string
): Promise<IFrqAttempt | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqAttempts)
		.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.submissionId, submissionId)))
		.limit(1);
	return rows[0] ? (await hydrateAttempts([rows[0] as IFrqAttempt]))[0] : null;
}

export async function findGradedFrqAttempt(
	userId: string,
	attemptId: string
): Promise<IFrqAttempt | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqAttempts)
		.where(
			and(
				eq(frqAttempts.id, attemptId),
				eq(frqAttempts.userId, userId),
				eq(frqAttempts.status, 'graded')
			)
		)
		.limit(1);
	return rows[0] ? (await hydrateAttempts([rows[0] as IFrqAttempt]))[0] : null;
}

export async function findRecentGradedFrqAttempts(
	userId: string,
	limit: number
): Promise<IFrqAttempt[]> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqAttempts)
		.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.status, 'graded')))
		.orderBy(desc(frqAttempts.createdAt))
		.limit(limit);
	return hydrateAttempts(rows as IFrqAttempt[]);
}

export async function updateFrqAttemptGrade(
	attempt: IFrqAttempt,
	grade: FrqGrade,
	gradingModel: string
): Promise<void> {
	const db = getNeonDatabase();
	const writes: any[] = [
		db
			.update(frqAttempts)
			.set({ status: 'graded', gradingModel, updatedAt: new Date() })
			.where(eq(frqAttempts.id, attempt.id)),
		db.delete(frqAttemptGrades).where(eq(frqAttemptGrades.attemptId, attempt.id)),
		db.delete(frqAttemptCriterionGrades).where(eq(frqAttemptCriterionGrades.attemptId, attempt.id)),
		db.insert(frqAttemptGrades).values({
			attemptId: attempt.id,
			pointsEarned: grade.pointsEarned,
			pointsAvailable: grade.pointsAvailable,
			percentage: grade.percentage,
			overallFeedback: grade.overallFeedback
		})
	];
	if (grade.criteria.length)
		writes.push(
			db
				.insert(frqAttemptCriterionGrades)
				.values(grade.criteria.map((item) => ({ attemptId: attempt.id, ...item })))
		);
	await db.batch(writes as [any, ...any[]]);
}

export async function deleteFrqAttemptIfGrading(attemptId: string): Promise<number> {
	const rows = await getNeonDatabase()
		.delete(frqAttempts)
		.where(and(eq(frqAttempts.id, attemptId), eq(frqAttempts.status, 'grading')))
		.returning({ id: frqAttempts.id });
	return rows.length;
}

export async function deleteFrqAttemptsForUser(userId: string): Promise<number> {
	const rows = await getNeonDatabase()
		.delete(frqAttempts)
		.where(eq(frqAttempts.userId, userId))
		.returning({ id: frqAttempts.id });
	return rows.length;
}
