import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, lt, notInArray, sql } from 'drizzle-orm';
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

/** The narrow row shape used by the anonymous pool-hit path. */
export type McqPoolQuestion = McqQuestionPayload & {
	questionId: string;
	randomKey: number;
	active: boolean;
	apClass: string;
	unit: string;
};

const jsonText = (field: string) => sql<string | null>`${mcqQuestions.data} ->> ${field}`;

const poolQuestionSelection = {
	questionId: mcqQuestions.questionId,
	randomKey: mcqQuestions.randomKey,
	active: mcqQuestions.active,
	apClass: sql<string>`COALESCE(NULLIF(${jsonText('apClass')}, ''), 'Unknown')`,
	unit: sql<string>`COALESCE(NULLIF(${jsonText('unit')}, ''), 'all-units')`,
	mainTopic: sql<string>`COALESCE(NULLIF(${jsonText('mainTopic')}, ''), NULLIF(${jsonText('topicsCovered')}, ''), 'Legacy topic')`,
	topicsCovered: sql<string>`COALESCE(${jsonText('topicsCovered')}, '')`,
	question: sql<string>`COALESCE(${jsonText('question')}, ${jsonText('prompt')}, '')`,
	optionA: sql<string>`COALESCE(${jsonText('optionA')}, ${mcqQuestions.data} -> 'options' -> 0 ->> 'text', ${mcqQuestions.data} -> 'options' -> 0 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 0, '')`,
	optionB: sql<string>`COALESCE(${jsonText('optionB')}, ${mcqQuestions.data} -> 'options' -> 1 ->> 'text', ${mcqQuestions.data} -> 'options' -> 1 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 1, '')`,
	optionC: sql<string>`COALESCE(${jsonText('optionC')}, ${mcqQuestions.data} -> 'options' -> 2 ->> 'text', ${mcqQuestions.data} -> 'options' -> 2 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 2, '')`,
	optionD: sql<string>`COALESCE(${jsonText('optionD')}, ${mcqQuestions.data} -> 'options' -> 3 ->> 'text', ${mcqQuestions.data} -> 'options' -> 3 ->> 'value', ${mcqQuestions.data} -> 'options' ->> 3, '')`,
	correctAnswer: sql<string>`COALESCE(${jsonText('correctAnswer')}, ${jsonText('answer')}, '')`,
	explanation: sql<string>`COALESCE(${jsonText('explanation')}, ${jsonText('rationale')}, '')`,
	diagramSpec: sql<Record<
		string,
		unknown
	> | null>`COALESCE(${mcqQuestions.data} -> 'diagramSpec', ${mcqQuestions.data} -> 'diagram')`,
	hasDiagram: sql<boolean>`CASE WHEN ${jsonText('hasDiagram')} = 'true' THEN true WHEN ${jsonText('hasDiagram')} = 'false' THEN false ELSE ${mcqQuestions.data} -> 'diagramSpec' IS NOT NULL OR ${mcqQuestions.data} -> 'diagram' IS NOT NULL END`
};

function normalizePoolCorrectAnswer(value: string): 'A' | 'B' | 'C' | 'D' {
	const upper = value.trim().toUpperCase();
	if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') return upper;
	const match = upper.match(/\b([A-D])\b/);
	if (match?.[1] === 'A' || match?.[1] === 'B' || match?.[1] === 'C' || match?.[1] === 'D') {
		return match[1];
	}
	throw new Error('Stored MCQ has an invalid answer key');
}

type McqPoolQuestionRow = Omit<McqPoolQuestion, 'correctAnswer' | 'diagramSpec'> & {
	correctAnswer: string;
	diagramSpec: unknown;
};

function poolQuestionFromRow(row: McqPoolQuestionRow): McqPoolQuestion {
	return {
		...row,
		mainTopic: row.mainTopic.trim() || row.topicsCovered.trim() || 'Legacy topic',
		topicsCovered: row.topicsCovered.trim(),
		question: row.question.trim(),
		optionA: row.optionA.trim(),
		optionB: row.optionB.trim(),
		optionC: row.optionC.trim(),
		optionD: row.optionD.trim(),
		correctAnswer: normalizePoolCorrectAnswer(row.correctAnswer),
		explanation: row.explanation.trim(),
		diagramSpec:
			row.diagramSpec && typeof row.diagramSpec === 'object' && !Array.isArray(row.diagramSpec)
				? (row.diagramSpec as Record<string, unknown>)
				: null,
		hasDiagram: row.hasDiagram || Boolean(row.diagramSpec)
	};
}

export type CanonicalMcqInput = Omit<
	IQuestion,
	| 'unit'
	| 'randomKey'
	| 'active'
	| 'hasDiagram'
	| 'diagramSpec'
	| 'mainTopic'
	| 'topicsCovered'
	| 'createdAt'
	| 'updatedAt'
> &
	Partial<
		Pick<
			IQuestion,
			'unit' | 'randomKey' | 'active' | 'hasDiagram' | 'diagramSpec' | 'mainTopic' | 'topicsCovered'
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
		explanation: input.explanation
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
}): Promise<McqPoolQuestion | null> {
	const db = getNeonDatabase(input.onDatabaseInit);
	const predicates = [
		eq(apClassField, input.apClass),
		eq(unitField, input.unit),
		eq(mcqQuestions.active, true),
		input.fromPivot === 'after'
			? gte(mcqQuestions.randomKey, input.pivot)
			: lt(mcqQuestions.randomKey, input.pivot)
	];
	if (input.excludeQuestionIds.length) {
		predicates.push(notInArray(mcqQuestions.questionId, input.excludeQuestionIds));
	}
	const rows = await db
		.select(poolQuestionSelection)
		.from(mcqQuestions)
		.where(and(...predicates))
		.orderBy(mcqQuestions.randomKey)
		.limit(1);
	return rows[0] ? poolQuestionFromRow(rows[0]) : null;
}

/** Select a batch around one random pivot in a single Neon HTTP batch. */
export async function findCachedQuestionsByPool(input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	limit: number;
	onDatabaseInit?: (elapsedMs: number) => void;
}): Promise<McqPoolQuestion[]> {
	const db = getNeonDatabase(input.onDatabaseInit);
	const createQuery = (fromPivot: 'after' | 'before') => {
		const predicates = [
			eq(apClassField, input.apClass),
			eq(unitField, input.unit),
			eq(mcqQuestions.active, true),
			fromPivot === 'after'
				? gte(mcqQuestions.randomKey, input.pivot)
				: lt(mcqQuestions.randomKey, input.pivot)
		];
		if (input.excludeQuestionIds.length) {
			predicates.push(notInArray(mcqQuestions.questionId, input.excludeQuestionIds));
		}
		return db
			.select(poolQuestionSelection)
			.from(mcqQuestions)
			.where(and(...predicates))
			.orderBy(mcqQuestions.randomKey)
			.limit(input.limit);
	};

	const [afterRows, beforeRows] = await db.batch([createQuery('after'), createQuery('before')]);
	return [...afterRows, ...beforeRows]
		.slice(0, input.limit)
		.map((row) => poolQuestionFromRow(row as McqPoolQuestionRow));
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
