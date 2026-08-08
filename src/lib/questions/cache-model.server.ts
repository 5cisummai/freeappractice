import { mcqQuestions, questionRegistry } from '$lib/server/neon/schema';
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
		s3QuestionId: string;
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

export function newPoolRandomKey(): number {
	return Math.random();
}

export const Question: PostgresModel<IQuestion> = model<IQuestion>({
	table: mcqQuestions as any,
	columns: mcqQuestions as any,
	idField: 'questionId',
	fieldAliases: { s3QuestionId: 'questionId' },
	fromRow: (row) => ({
		...(row as unknown as IQuestion),
		s3QuestionId: String(row.questionId)
	}),
	prepareInsert: async (input) => {
		const questionId = String(input.questionId ?? input.s3QuestionId ?? '');
		if (!questionId) throw new Error('MCQ question requires s3QuestionId');
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
