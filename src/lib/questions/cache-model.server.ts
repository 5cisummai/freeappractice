import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IQuestion extends Document {
	apClass: string;
	unit: string;
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	/** SHA-256 of the normalized question text — used for exact-duplicate detection. */
	contentHash?: string;
	/** Brief description of the specific concept this question tests — used for diversity tracking. */
	topicsCovered?: string;
	lastServedAt: Date | null;
	status: 'available' | 'serving' | 'retired' | 'generating';
	serveCount: number;
	maxServeCount: number;
	lockedUntil: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true, default: 'all-units' },
		question: { type: String, required: true },
		optionA: { type: String, required: true },
		optionB: { type: String, required: true },
		optionC: { type: String, required: true },
		optionD: { type: String, required: true },
		correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
		explanation: { type: String, required: true },
		contentHash: { type: String },
		topicsCovered: { type: String },
		lastServedAt: { type: Date, default: null },
		status: {
			type: String,
			enum: ['available', 'serving', 'retired', 'generating'],
			default: 'available',
			required: true
		},
		serveCount: { type: Number, default: 0 },
		maxServeCount: { type: Number, default: 50 },
		lockedUntil: { type: Date, default: null }
	},
	{ timestamps: true }
);

// Compound index for efficient cache lookups
questionSchema.index({ apClass: 1, unit: 1, status: 1, lastServedAt: 1 });
// Sparse unique index so only documents with a hash are deduplicated
questionSchema.index({ contentHash: 1 }, { unique: true, sparse: true });

// Prevent OverwriteModelError during hot-reload in dev
export const Question: Model<IQuestion> =
	(mongoose.models.Question as Model<IQuestion>) ??
	mongoose.model<IQuestion>('Question', questionSchema);
