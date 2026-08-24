import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, lt, ne, notInArray, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	mcqQuestions,
	questionRecentTopics,
	questionRegistry,
	type McqQuestionPayload
} from '$lib/server/neon/schema';
import { questionBucketFields } from '$lib/server/neon/jsonb';
import { parseMcqQuestionPayload } from '$lib/question-bank/mcq/payload-schema';
import { resolveQuestionMainTopic } from '$lib/question-bank/main-topic';

export interface IQuestion extends McqQuestionPayload {
	questionId: string;
	randomKey: number;
	active: boolean;
	contentHash: string;
	createdAt: Date;
	updatedAt: Date;
}

const { apClass: apClassField, unit: unitField } = questionBucketFields(mcqQuestions.data);

export type CanonicalMcqInput = Omit<
	IQuestion,
	| 'unit'
	| 'randomKey'
	| 'active'
	| 'hasDiagram'
	| 'diagramSpec'
	| 'hint1'
	| 'hint2'
	| 'mainTopic'
	| 'topicsCovered'
	| 'createdAt'
	| 'updatedAt'
> &
	Partial<
		Pick<
			IQuestion,
			| 'unit'
			| 'randomKey'
			| 'active'
			| 'hasDiagram'
			| 'diagramSpec'
			| 'hint1'
			| 'hint2'
			| 'mainTopic'
			| 'topicsCovered'
		>
	>;

export function newPoolRandomKey(): number {
	return Math.random();
}

export async function countActiveMcqQuestions(apClass: string, unit: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(mcqQuestions)
		.where(and(eq(apClassField, apClass), eq(unitField, unit), eq(mcqQuestions.active, true)));
	return Number(row?.count ?? 0);
}

function fromRow(row: typeof mcqQuestions.$inferSelect): IQuestion {
	const { data, ...metadata } = row;
	return { ...parseMcqQuestionPayload(data), ...metadata };
}

/** Insert a generated MCQ and its serving metadata in one Neon batch. */
export async function createCanonicalMcqQuestion(input: CanonicalMcqInput): Promise<IQuestion> {
	const questionId = input.questionId.trim();
	if (!questionId) throw new Error('MCQ question requires questionId');

	const unit = input.unit ?? 'all-units';
	const topicsCovered = input.topicsCovered?.trim() ?? '';
	const mainTopic = resolveQuestionMainTopic(input.mainTopic, topicsCovered) || 'Legacy topic';
	const data: McqQuestionPayload = {
		apClass: input.apClass,
		unit,
		mainTopic,
		topicsCovered,
		question: input.question,
		diagramSpec: input.diagramSpec ?? null,
		hasDiagram: input.hasDiagram ?? Boolean(input.diagramSpec),
		optionA: input.optionA,
		optionB: input.optionB,
		optionC: input.optionC,
		optionD: input.optionD,
		correctAnswer: input.correctAnswer,
		explanation: input.explanation,
		hint1: input.hint1 ?? null,
		hint2: input.hint2 ?? null
	};
	const db = getNeonDatabase();
	const registryInsert = db
		.insert(questionRegistry)
		.values({
			questionId,
			kind: 'mcq',
			apClass: input.apClass,
			unit,
			contentHash: input.contentHash,
			contentLength: input.question.length
		})
		.onConflictDoUpdate({
			target: questionRegistry.questionId,
			set: {
				kind: 'mcq',
				apClass: input.apClass,
				unit,
				contentHash: input.contentHash,
				contentLength: input.question.length
			}
		});
	const mcqInsert = db
		.insert(mcqQuestions)
		.values({
			questionId,
			data,
			contentHash: input.contentHash,
			randomKey: input.randomKey ?? newPoolRandomKey(),
			active: input.active ?? true
		})
		.returning();
	const recentTopicInsert = topicsCovered
		? db.insert(questionRecentTopics).values({
				id: randomUUID(),
				kind: 'mcq',
				apClass: input.apClass,
				unit,
				topicsCovered,
				questionId
			})
		: null;

	const results = recentTopicInsert
		? await db.batch([registryInsert, mcqInsert, recentTopicInsert])
		: await db.batch([registryInsert, mcqInsert]);
	const row = (results[1] as Array<typeof mcqQuestions.$inferSelect>)[0];
	if (!row) throw new Error('PostgreSQL MCQ insert returned no row');
	return fromRow(row);
}

export async function findCachedQuestionByPool(input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	fromPivot: 'after' | 'before';
	onDatabaseInit?: (elapsedMs: number) => void;
}): Promise<IQuestion | null> {
	const db = getNeonDatabase(input.onDatabaseInit);
	const predicates = [
		eq(apClassField, input.apClass),
		eq(unitField, input.unit),
		ne(mcqQuestions.active, false),
		input.fromPivot === 'after'
			? gte(mcqQuestions.randomKey, input.pivot)
			: lt(mcqQuestions.randomKey, input.pivot)
	];
	if (input.excludeQuestionIds.length) {
		predicates.push(notInArray(mcqQuestions.questionId, input.excludeQuestionIds));
	}
	const rows = await db
		.select()
		.from(mcqQuestions)
		.where(and(...predicates))
		.orderBy(mcqQuestions.randomKey)
		.limit(1);
	return rows[0] ? fromRow(rows[0]) : null;
}

export async function findCachedQuestion(questionId: string): Promise<IQuestion | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(mcqQuestions)
		.where(eq(mcqQuestions.questionId, questionId))
		.limit(1);
	return rows[0] ? fromRow(rows[0]) : null;
}

export async function findCachedQuestions(questionIds: string[]): Promise<IQuestion[]> {
	if (!questionIds.length) return [];
	const rows = await getNeonDatabase()
		.select()
		.from(mcqQuestions)
		.where(inArray(mcqQuestions.questionId, questionIds));
	return rows.map(fromRow);
}

export async function findAllCachedQuestions(): Promise<IQuestion[]> {
	const rows = await getNeonDatabase().select().from(mcqQuestions);
	return rows.map(fromRow);
}

export interface StoredQuestion {
	id: string;
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	hint1?: string;
	hint2?: string;
	apClass?: string;
	unit?: string;
	mainTopic?: string;
	contentHash?: string;
	topicsCovered?: string;
	diagramSpec?: Record<string, unknown>;
	hasDiagram: boolean;
	createdAt: string;
}

export function storedQuestionFromPayload(input: {
	questionId: string;
	data: McqQuestionPayload;
	contentHash?: string | null;
	createdAt: Date;
}): StoredQuestion {
	const { data } = input;
	return {
		id: input.questionId,
		question: data.question,
		optionA: data.optionA,
		optionB: data.optionB,
		optionC: data.optionC,
		optionD: data.optionD,
		correctAnswer: data.correctAnswer,
		explanation: data.explanation,
		...(data.hint1 != null ? { hint1: data.hint1 } : {}),
		...(data.hint2 != null ? { hint2: data.hint2 } : {}),
		apClass: data.apClass,
		unit: data.unit,
		mainTopic: data.mainTopic,
		...(input.contentHash ? { contentHash: input.contentHash } : {}),
		...(data.topicsCovered?.trim() ? { topicsCovered: data.topicsCovered } : {}),
		...(data.diagramSpec ? { diagramSpec: data.diagramSpec } : {}),
		hasDiagram: data.hasDiagram ?? Boolean(data.diagramSpec),
		createdAt: input.createdAt.toISOString()
	};
}

function toStoredQuestion(question: IQuestion): StoredQuestion {
	return storedQuestionFromPayload({
		questionId: question.questionId,
		data: question,
		contentHash: question.contentHash,
		createdAt: question.createdAt
	});
}

/** Resolve an MCQ body from its canonical Neon row. */
export async function getQuestionById(questionId: string): Promise<StoredQuestion> {
	const normalizedId = questionId.trim();
	if (!normalizedId) throw new Error('Question id is required');

	const question = await findCachedQuestion(normalizedId);
	if (!question) throw new Error(`Question not found: ${normalizedId}`);
	return toStoredQuestion(question);
}

/** Build a lookup map from canonical Neon MCQ rows. */
export async function getQuestionsLookupMap(
	questionIds: string[]
): Promise<Map<string, StoredQuestion>> {
	const uniqueIds = [...new Set(questionIds.map((id) => id.trim()).filter(Boolean))];
	const map = new Map<string, StoredQuestion>();
	if (uniqueIds.length === 0) return map;

	const questions = await findCachedQuestions(uniqueIds);
	for (const question of questions) {
		const stored = toStoredQuestion(question);
		map.set(stored.id, stored);
	}
	return map;
}

export async function getQuestionsByIds(questionIds: string[]): Promise<StoredQuestion[]> {
	const uniqueIds = [...new Set(questionIds.map((id) => id.trim()).filter(Boolean))];
	if (uniqueIds.length === 0) return [];

	const map = await getQuestionsLookupMap(uniqueIds);
	return uniqueIds.map((id) => map.get(id)).filter((q): q is StoredQuestion => q !== undefined);
}

/** List all canonical MCQs for maintenance and quality tooling. */
export async function getAllQuestions(): Promise<StoredQuestion[]> {
	const questions = await findAllCachedQuestions();
	return questions.map(toStoredQuestion);
}
