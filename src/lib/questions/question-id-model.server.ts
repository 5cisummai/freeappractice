import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Canonical registry of every question id persisted to S3. */
export interface IQuestionId extends Document {
	questionId: string;
	createdAt: Date;
	updatedAt: Date;
}

const questionIdSchema = new Schema<IQuestionId>(
	{
		questionId: { type: String, required: true, unique: true, index: true }
	},
	{ timestamps: true }
);

export const QuestionId: Model<IQuestionId> =
	(mongoose.models.QuestionId as Model<IQuestionId>) ??
	mongoose.model<IQuestionId>('QuestionId', questionIdSchema, 'question_ids');
