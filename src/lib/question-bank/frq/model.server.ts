import { randomUUID } from 'node:crypto';
import { and, eq, gte, lt, ne, notInArray, sql } from 'drizzle-orm';
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
	frqQuestions,
	questionRecentTopics,
	questionRegistry,
	type FrqQuestionPayload
} from '$lib/server/neon/schema';
import { questionBucketFields } from '$lib/server/neon/jsonb';
import { resolveQuestionMainTopic } from '$lib/question-bank/main-topic';

export interface IFrqQuestion extends FrqQuestionPayload {
	contentHash: string;
	questionId: string;
	randomKey: number;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const { apClass: apClassField, unit: unitField } = questionBucketFields(frqQuestions.data);

export function newFrqPoolRandomKey(): number {
	return Math.random();
}

export async function countActiveFrqQuestions(apClass: string, unit: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(frqQuestions)
		.where(and(eq(apClassField, apClass), eq(unitField, unit), eq(frqQuestions.active, true)));
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
		mainTopic: resolveQuestionMainTopic(doc.mainTopic, doc.topicsCovered),
		topicsCovered: doc.topicsCovered,
		apClass: doc.apClass,
		unit: doc.unit
	});
}

function frqQuestionRow(row: typeof frqQuestions.$inferSelect): IFrqQuestion {
	const { data, ...metadata } = row;
	const topicsCovered = data.topicsCovered;
	const mainTopic = resolveQuestionMainTopic(data.mainTopic, topicsCovered) || 'Legacy topic';
	return { ...data, mainTopic, topicsCovered, ...metadata };
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
		eq(apClassField, input.apClass),
		eq(unitField, input.unit),
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
	return rows[0] ? frqQuestionRow(rows[0]) : null;
}

export async function findFrqQuestionById(questionId: string): Promise<IFrqQuestion | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqQuestions)
		.where(eq(frqQuestions.questionId, questionId))
		.limit(1);
	return rows[0] ? frqQuestionRow(rows[0]) : null;
}

export async function listFrqQuestions(): Promise<IFrqQuestion[]> {
	const rows = await getNeonDatabase().select().from(frqQuestions);
	return rows.map(frqQuestionRow);
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
	mainTopic?: string;
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
	const data: FrqQuestionPayload = {
		apClass: input.apClass,
		unit: input.unit,
		formatId: input.formatId,
		profileVersion: input.profileVersion,
		promptVersion: input.promptVersion,
		rubricVersion: input.rubricVersion,
		schemaVersion: input.schemaVersion ?? 1,
		prompt: input.prompt,
		materials: input.materials ?? [],
		sections: input.sections ?? [],
		rubric: input.rubric ?? [],
		totalPoints: input.totalPoints,
		mainTopic: resolveQuestionMainTopic(input.mainTopic, input.topicsCovered) || 'Legacy topic',
		topicsCovered: input.topicsCovered
	};

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
			data,
			contentHash: input.contentHash,
			randomKey: input.randomKey ?? newFrqPoolRandomKey(),
			active: input.active ?? true,
			createdAt,
			updatedAt
		})
		.onConflictDoUpdate({
			target: frqQuestions.questionId,
			set: {
				data,
				contentHash: input.contentHash,
				randomKey: input.randomKey ?? newFrqPoolRandomKey(),
				active: input.active ?? true,
				updatedAt
			}
		});

	// Keep the registry, question, and recent-topic writes atomic in Neon.
	const writes: [BatchItem<'pg'>, ...BatchItem<'pg'>[]] = [registryInsert, questionInsert];

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
	return row;
}
