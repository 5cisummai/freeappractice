import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, lt, ne, notInArray, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { mcqQuestions, questionRecentTopics, questionRegistry } from '$lib/server/neon/schema';

export interface IQuestion {
	questionId: string;
	apClass: string;
	unit: string;
	topicsCovered?: string | null;
	randomKey: number;
	active: boolean;
	contentHash: string;
	question: string;
	diagramSpec?: Record<string, unknown> | null;
	hasDiagram: boolean;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	hint1?: string | null;
	hint2?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export type CanonicalMcqInput = Omit<
	IQuestion,
	'unit' | 'randomKey' | 'active' | 'hasDiagram' | 'createdAt' | 'updatedAt'
> &
	Partial<Pick<IQuestion, 'unit' | 'randomKey' | 'active' | 'hasDiagram'>>;

export function newPoolRandomKey(): number {
	return Math.random();
}

export async function countActiveMcqQuestions(apClass: string, unit: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(mcqQuestions)
		.where(
			and(
				eq(mcqQuestions.apClass, apClass),
				eq(mcqQuestions.unit, unit),
				eq(mcqQuestions.active, true)
			)
		);
	return Number(row?.count ?? 0);
}

function fromRow(row: typeof mcqQuestions.$inferSelect): IQuestion {
	return { ...row, correctAnswer: row.correctAnswer as IQuestion['correctAnswer'] };
}

/** Insert a generated MCQ and its serving metadata in one Neon batch. */
export async function createCanonicalMcqQuestion(input: CanonicalMcqInput): Promise<IQuestion> {
	const questionId = input.questionId.trim();
	if (!questionId) throw new Error('MCQ question requires questionId');

	const unit = input.unit ?? 'all-units';
	const topicsCovered = input.topicsCovered?.trim() ?? '';
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
			apClass: input.apClass,
			unit,
			contentHash: input.contentHash,
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
			hint1: input.hint1,
			hint2: input.hint2,
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
	const row = (results[1] as IQuestion[])[0];
	if (!row) throw new Error('PostgreSQL MCQ insert returned no row');
	return row;
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
		eq(mcqQuestions.apClass, input.apClass),
		eq(mcqQuestions.unit, input.unit),
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
	contentHash?: string;
	topicsCovered?: string;
	diagramSpec?: Record<string, unknown>;
	hasDiagram: boolean;
	createdAt: string;
}

function toStoredQuestion(question: IQuestion): StoredQuestion {
	return {
		id: question.questionId,
		question: question.question,
		optionA: question.optionA,
		optionB: question.optionB,
		optionC: question.optionC,
		optionD: question.optionD,
		correctAnswer: question.correctAnswer,
		explanation: question.explanation,
		...(question.hint1 != null ? { hint1: question.hint1 } : {}),
		...(question.hint2 != null ? { hint2: question.hint2 } : {}),
		apClass: question.apClass,
		unit: question.unit,
		contentHash: question.contentHash,
		topicsCovered: question.topicsCovered ?? undefined,
		diagramSpec: question.diagramSpec ?? undefined,
		hasDiagram: question.hasDiagram,
		createdAt: new Date(question.createdAt).toISOString()
	};
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
