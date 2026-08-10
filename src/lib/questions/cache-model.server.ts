import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, lt, ne, notInArray } from 'drizzle-orm';
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
}): Promise<IQuestion | null> {
	const db = getNeonDatabase();
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
