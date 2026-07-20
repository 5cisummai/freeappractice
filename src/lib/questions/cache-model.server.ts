import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Shared pool metadata. */
interface IPoolDocMetadata {
	apClass: string;
	unit: string;
	topicsCovered?: string;
	/** Stable random pivot for indexed selection; assigned once at insert/backfill. */
	randomKey: number;
	/** Soft-active flag — quality rejection / rotation without deleting S3 history. */
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Active serving-library entry — full MCQ body inline plus durable S3 id. */
type HotPoolDoc = IPoolDocMetadata & {
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
 * MongoDB active question library. Full MCQ inline for fast serves, with S3 written
 * once by the shared generation/backfill path before a doc enters the pool.
 */
export interface IQuestion extends Document, HotPoolDoc {}

/** Assign a one-time random pivot in [0, 1). */
export function newPoolRandomKey(): number {
	return Math.random();
}

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
		s3QuestionId: { type: String, required: true },
		randomKey: { type: Number, required: true, default: newPoolRandomKey },
		active: { type: Boolean, required: true, default: true }
	},
	{ timestamps: true }
);

questionSchema.index({ apClass: 1, unit: 1, createdAt: 1 });
questionSchema.index({ apClass: 1, unit: 1, active: 1, randomKey: 1 });
questionSchema.index({ contentHash: 1 }, { unique: true, sparse: true });
questionSchema.index({ s3QuestionId: 1 }, { unique: true, sparse: true });

export const Question: Model<IQuestion> =
	(mongoose.models.Question as Model<IQuestion>) ??
	mongoose.model<IQuestion>('Question', questionSchema);
