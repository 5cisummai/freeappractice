import { questionRegistry } from '$lib/server/neon/schema';
import { model, type PostgresModel } from '$lib/server/neon/model';

export interface IQuestionId {
	_id: string;
	questionId: string;
	kind?: 'mcq' | 'frq';
	apClass?: string;
	unit?: string;
	questionCreatedAt?: Date;
	s3Etag?: string;
	contentHash?: string;
	contentLength?: number;
	metadataSyncedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export const QuestionId: PostgresModel<IQuestionId> = model<IQuestionId>({
	table: questionRegistry as any,
	columns: questionRegistry as any,
	idField: 'questionId',
	prepareInsert: async (input) => ({
		...input,
		kind: input.kind ?? 'mcq'
	})
});
