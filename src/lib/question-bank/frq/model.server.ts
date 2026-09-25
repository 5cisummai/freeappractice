import { randomUUID } from 'node:crypto';
import { and, eq, gte, lt, ne, notInArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { frqStoredPoolFilter } from '$lib/question-bank/frq/practice';
import { FrqQuestionSchema, type FrqQuestion } from '$lib/question-bank/frq/types';
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

const { course: courseField, unit: unitField } = questionBucketFields(frqQuestions.data);
const formatField = sql<string>`${frqQuestions.data} ->> 'formatId'`;

export function newFrqPoolRandomKey(): number {
	return Math.random();
}

export async function countActiveFrqQuestions(course: string, unit: string): Promise<number> {
	const filter = frqStoredPoolFilter(course, unit);
	const predicates = [
		eq(courseField, course),
		eq(unitField, filter.unit),
		eq(frqQuestions.active, true)
	];
	if (filter.formatId) predicates.push(eq(formatField, filter.formatId));
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(frqQuestions)
		.where(and(...predicates));
	return Number(row?.count ?? 0);
}

export function toFrqQuestion(doc: IFrqQuestion): FrqQuestion {
	const { contentHash, questionId, randomKey, active, createdAt, updatedAt, ...data } = doc;
	void contentHash;
	void questionId;
	void randomKey;
	void active;
	void createdAt;
	void updatedAt;
	return FrqQuestionSchema.parse({
		...data,
		mainTopic: resolveQuestionMainTopic(data.mainTopic, data.topicsCovered)
	});
}

function frqQuestionRow(row: typeof frqQuestions.$inferSelect): IFrqQuestion {
	const { data, ...metadata } = row;
	const topicsCovered = data.topicsCovered;
	const mainTopic = resolveQuestionMainTopic(data.mainTopic, topicsCovered) || 'Legacy topic';
	return { ...data, mainTopic, topicsCovered, ...metadata };
}

export async function findFrqQuestionByPool(input: {
	course: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	fromPivot: 'after' | 'before';
	onDatabaseInit?: (elapsedMs: number) => void;
}): Promise<IFrqQuestion | null> {
	const filter = frqStoredPoolFilter(input.course, input.unit);
	const predicates = [
		eq(courseField, input.course),
		eq(unitField, filter.unit),
		ne(frqQuestions.active, false),
		input.fromPivot === 'after'
			? gte(frqQuestions.randomKey, input.pivot)
			: lt(frqQuestions.randomKey, input.pivot)
	];
	if (filter.formatId) predicates.push(eq(formatField, filter.formatId));
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

export async function createFrqQuestion(
	input: FrqQuestion & {
		questionId?: string;
		contentHash: string;
		randomKey?: number;
		active?: boolean;
		createdAt?: Date;
		updatedAt?: Date;
	}
): Promise<IFrqQuestion> {
	const db = getNeonDatabase();
	const questionId = String(input.questionId ?? '');
	if (!questionId) throw new Error('FRQ question requires questionId');
	const createdAt = input.createdAt ?? new Date();
	const updatedAt = input.updatedAt ?? createdAt;
	const data: FrqQuestionPayload = FrqQuestionSchema.parse({
		schemaVersion: input.schemaVersion,
		formatId: input.formatId,
		responseMode: input.responseMode,
		prompt: input.prompt,
		materials: input.materials,
		parts: input.parts,
		mainTopic: resolveQuestionMainTopic(input.mainTopic, input.topicsCovered),
		topicsCovered: input.topicsCovered,
		course: input.course,
		unit: input.unit
	});

	const registryInsert = db
		.insert(questionRegistry)
		.values({
			questionId,
			kind: 'frq',
			course: input.course,
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
				course: input.course,
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
				course: input.course,
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
