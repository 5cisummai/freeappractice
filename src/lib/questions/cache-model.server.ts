import { randomUUID } from 'node:crypto';
import { mcqQuestions, questionRecentTopics, questionRegistry } from '$lib/server/neon/schema';
import { getNeonDatabase } from '$lib/server/neon/db';
import { model, type PostgresModel } from '$lib/server/neon/model';

type DocumentFields = { _id: string; save: () => Promise<unknown> };

interface IPoolDocMetadata {
	apClass: string;
	unit: string;
	topicsCovered?: string;
	randomKey: number;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export type IQuestion = DocumentFields &
	IPoolDocMetadata & {
		questionId: string;
		contentHash: string;
		question: string;
		optionA: string;
		optionB: string;
		optionC: string;
		optionD: string;
		correctAnswer: 'A' | 'B' | 'C' | 'D';
		explanation: string;
		hint1?: string;
		hint2?: string;
	};

export type CanonicalMcqInput = Omit<
	IQuestion,
	'_id' | 'save' | 'unit' | 'randomKey' | 'active' | 'createdAt' | 'updatedAt'
> &
	Partial<Pick<IQuestion, 'unit' | 'randomKey' | 'active'>>;

export function newPoolRandomKey(): number {
	return Math.random();
}

/**
 * Insert a generated MCQ and all of its canonical metadata as one Neon HTTP
 * batch. The registry must exist before the MCQ because the MCQ row has a
 * foreign key to it; the batch keeps the three writes atomic if any insert
 * fails, including content-hash duplicate detection.
 */
export async function createCanonicalMcqQuestion(input: CanonicalMcqInput): Promise<IQuestion> {
	const questionId = String(input.questionId ?? '');
	if (!questionId) throw new Error('MCQ question requires questionId');

	const unit = input.unit ?? 'all-units';
	const randomKey = input.randomKey ?? newPoolRandomKey();
	const active = input.active ?? true;
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
			optionA: input.optionA,
			optionB: input.optionB,
			optionC: input.optionC,
			optionD: input.optionD,
			correctAnswer: input.correctAnswer,
			explanation: input.explanation,
			hint1: input.hint1,
			hint2: input.hint2,
			randomKey,
			active
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
	const questionRows = results[1] as Array<Record<string, unknown>>;
	const row = questionRows[0];
	if (!row) throw new Error('PostgreSQL MCQ insert returned no row');

	const document = { ...row, _id: row.questionId } as IQuestion;
	Object.defineProperty(document, 'save', {
		configurable: true,
		enumerable: false,
		value: async () => {
			await Question.updateOne({ _id: document._id }, { $set: document });
			return document;
		}
	});
	Object.defineProperty(document, 'deleteOne', {
		configurable: true,
		enumerable: false,
		value: async () => Question.deleteOne({ _id: document._id }).exec()
	});
	return document;
}

export const Question: PostgresModel<IQuestion> = model<IQuestion>({
	table: mcqQuestions as any,
	columns: mcqQuestions as any,
	idField: 'questionId',
	fromRow: (row) => row as unknown as IQuestion,
	prepareInsert: async (input) => {
		const questionId = String(input.questionId ?? '');
		if (!questionId) throw new Error('MCQ question requires questionId');
		const db = getNeonDatabase() as any;
		await db
			.insert(questionRegistry as any)
			.values({
				questionId,
				kind: 'mcq',
				apClass: input.apClass,
				unit: input.unit ?? 'all-units',
				contentHash: input.contentHash,
				contentLength: String(input.question ?? '').length
			})
			.onConflictDoUpdate({
				target: (questionRegistry as any).questionId,
				set: {
					kind: 'mcq',
					apClass: input.apClass,
					unit: input.unit ?? 'all-units',
					contentHash: input.contentHash,
					contentLength: String(input.question ?? '').length
				}
			});
		return {
			...input,
			questionId,
			unit: input.unit ?? 'all-units',
			randomKey: input.randomKey ?? newPoolRandomKey(),
			active: input.active ?? true
		};
	}
});
