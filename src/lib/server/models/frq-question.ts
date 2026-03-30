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
	lastServedAt: Date | null;
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
		lastServedAt: { type: Date, default: null }
	},
	{ timestamps: true }
);

frqQuestionSchema.index({ apClass: 1, unit: 1, lastServedAt: 1 });

export const FRQQuestion: Model<IFRQQuestion> =
	(mongoose.models.FRQQuestion as Model<IFRQQuestion>) ??
	mongoose.model<IFRQQuestion>('FRQQuestion', frqQuestionSchema);
