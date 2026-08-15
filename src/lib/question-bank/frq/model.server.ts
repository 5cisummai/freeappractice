import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, inArray, lt, ne, notInArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import {
	FrqQuestionSchema,
	type FrqMaterial,
	type FrqRubricCriterion,
	type FrqSection,
	type FrqQuestion
} from '$lib/question-bank/frq/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
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

export async function countActiveFrqQuestions(apClass: string, unit: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(frqQuestions)
		.where(
			and(
				eq(frqQuestions.apClass, apClass),
				eq(frqQuestions.unit, unit),
				eq(frqQuestions.active, true)
			)
		);
	return Number(row?.count ?? 0);
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

export async function listFrqQuestions(): Promise<IFrqQuestion[]> {
	const rows = await getNeonDatabase().select().from(frqQuestions);
	return hydrateFrqQuestions(rows.map(frqQuestionRow));
}

/** Resolve a complete FRQ from its canonical Neon rows. */
export async function getFrqQuestionById(questionId: string): Promise<FrqQuestion> {
	const normalizedId = questionId.trim();
	if (!normalizedId) throw new Error('FRQ question id is required');

	const question = await findFrqQuestionById(normalizedId);
	if (!question) throw new Error(`FRQ question not found: ${normalizedId}`);
	return toFrqQuestion(question);
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
