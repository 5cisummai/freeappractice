import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Shared pool metadata. */
interface IPoolDocMetadata {
	apClass: string;
	unit: string;
	topicsCovered?: string;
	createdAt: Date;
	updatedAt: Date;
}

/** Ephemeral hot-cache pool entry — full MCQ body inline plus durable S3 id. */
export type HotPoolDoc = IPoolDocMetadata & {
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

/**
 * MongoDB hot question cache. Full MCQ inline for fast serves, with S3 written
 * once by the shared generation path before a doc enters the pool.
 */
export interface IQuestion extends Document, HotPoolDoc {}

const questionSchema = new Schema<IQuestion>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true, default: 'all-units' },
		contentHash: { type: String, required: true },
		topicsCovered: { type: String },
		question: { type: String, required: true },
		optionA: { type: String, required: true },
		optionB: { type: String, required: true },
		optionC: { type: String, required: true },
		optionD: { type: String, required: true },
		correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
		explanation: { type: String, required: true },
		hint1: { type: String },
		hint2: { type: String },
		s3QuestionId: { type: String, required: true }
	},
	{ timestamps: true }
);

questionSchema.index({ apClass: 1, unit: 1, createdAt: 1 });
questionSchema.index({ contentHash: 1 }, { unique: true, sparse: true });
questionSchema.index({ s3QuestionId: 1 }, { unique: true, sparse: true });

export const Question: Model<IQuestion> =
	(mongoose.models.Question as Model<IQuestion>) ??
	mongoose.model<IQuestion>('Question', questionSchema);
