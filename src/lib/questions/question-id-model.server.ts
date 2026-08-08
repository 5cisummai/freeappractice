import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Canonical registry of every question id persisted to S3. */
export interface IQuestionId extends Document {
	questionId: string;
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

const questionIdSchema = new Schema<IQuestionId>(
	{
		questionId: { type: String, required: true, unique: true, index: true },
		apClass: { type: String, index: true },
		unit: { type: String, index: true },
		questionCreatedAt: { type: Date, index: true },
		s3Etag: String,
		contentHash: String,
		contentLength: Number,
		metadataSyncedAt: Date
	},
	{ timestamps: true }
);

export const QuestionId: Model<IQuestionId> =
	(mongoose.models.QuestionId as Model<IQuestionId>) ??
	mongoose.model<IQuestionId>('QuestionId', questionIdSchema, 'question_ids');
