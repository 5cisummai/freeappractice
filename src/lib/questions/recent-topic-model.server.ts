import { randomUUID } from 'node:crypto';
import { questionRecentTopics } from '$lib/server/neon/schema';
import { model, type PostgresModel } from '$lib/server/neon/model';

export interface IQuestionRecentTopic {
	_id: string;
	apClass: string;
	unit: string;
	topicsCovered: string;
	questionId?: string;
	createdAt: Date;
}

export const QuestionRecentTopic: PostgresModel<IQuestionRecentTopic> = model<IQuestionRecentTopic>(
	{
		table: questionRecentTopics as any,
		columns: questionRecentTopics as any,
		idField: 'id',
		prepareInsert: async (input) => ({
			...input,
			id: input.id ?? randomUUID(),
			kind: 'mcq',
			questionId: input.questionId ?? null
		}),
		fromRow: (row) => row as unknown as IQuestionRecentTopic
	}
);
