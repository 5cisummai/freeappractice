import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IFRQPart {
	label: string; // 'a', 'b', 'c', 'd'
	question: string;
	pointValue: number;
	scoringCriteria: string;
	modelAnswer: string;
}

export interface IFRQQuestion extends Document {
	apClass: string;
	unit: string;
	prompt: string;
	context?: string;
	parts: IFRQPart[];
	totalPoints: number;
	/** SHA-256 of the normalized prompt text — used for exact-duplicate detection. */
	contentHash?: string;
	/** Brief description of the specific concept this FRQ tests — used for diversity tracking. */
	topicsCovered?: string;
	lastServedAt: Date | null;
	status: 'available' | 'serving' | 'retired' | 'generating';
	serveCount: number;
	maxServeCount: number;
	lockedUntil: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

const frqPartSchema = new Schema<IFRQPart>(
	{
		label: { type: String, required: true },
		question: { type: String, required: true },
		pointValue: { type: Number, required: true, min: 1 },
		scoringCriteria: { type: String, required: true },
		modelAnswer: { type: String, required: true }
	},
	{ _id: false }
);

const frqQuestionSchema = new Schema<IFRQQuestion>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true, default: 'all-units' },
		prompt: { type: String, required: true },
		context: { type: String },
		parts: { type: [frqPartSchema], required: true },
		totalPoints: { type: Number, required: true, min: 1 },
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

frqQuestionSchema.index({ apClass: 1, unit: 1, status: 1, lastServedAt: 1 });
frqQuestionSchema.index({ contentHash: 1 }, { unique: true, sparse: true });

export const FRQQuestion: Model<IFRQQuestion> =
	(mongoose.models.FRQQuestion as Model<IFRQQuestion>) ??
	mongoose.model<IFRQQuestion>('FRQQuestion', frqQuestionSchema);
