import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Total MCQs generated per AP course (matches S3 canonical questions per class). */
export interface IQuestionGenClassTotal extends Document {
	apClass: string;
	count: number;
	totalQuestionChars: number;
}

const classTotalSchema = new Schema<IQuestionGenClassTotal>(
	{
		apClass: { type: String, required: true, unique: true },
		count: { type: Number, required: true, default: 0 },
		totalQuestionChars: { type: Number, required: true, default: 0 }
	},
	{ timestamps: true }
);

export const QuestionGenClassTotal: Model<IQuestionGenClassTotal> =
	(mongoose.models.QuestionGenClassTotal as Model<IQuestionGenClassTotal>) ??
	mongoose.model<IQuestionGenClassTotal>('QuestionGenClassTotal', classTotalSchema);

/** Per (course, unit) counts — authoritative unit breakdown within a class. */
export interface IQuestionGenUnitDetail extends Document {
	apClass: string;
	unit: string;
	count: number;
	totalQuestionChars: number;
}

const unitDetailSchema = new Schema<IQuestionGenUnitDetail>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true },
		count: { type: Number, required: true, default: 0 },
		totalQuestionChars: { type: Number, required: true, default: 0 }
	},
	{ timestamps: true }
);

unitDetailSchema.index({ apClass: 1, unit: 1 }, { unique: true });

export const QuestionGenUnitDetail: Model<IQuestionGenUnitDetail> =
	(mongoose.models.QuestionGenUnitDetail as Model<IQuestionGenUnitDetail>) ??
	mongoose.model<IQuestionGenUnitDetail>('QuestionGenUnitDetail', unitDetailSchema);

/**
 * Global rollup by unit label (same string may appear in multiple courses —
 * counts are summed, matching legacy batch-analyze `byUnit` reports).
 */
export interface IQuestionGenUnitGlobal extends Document {
	unit: string;
	count: number;
	totalQuestionChars: number;
}

const unitGlobalSchema = new Schema<IQuestionGenUnitGlobal>(
	{
		unit: { type: String, required: true, unique: true },
		count: { type: Number, required: true, default: 0 },
		totalQuestionChars: { type: Number, required: true, default: 0 }
	},
	{ timestamps: true }
);

export const QuestionGenUnitGlobal: Model<IQuestionGenUnitGlobal> =
	(mongoose.models.QuestionGenUnitGlobal as Model<IQuestionGenUnitGlobal>) ??
	mongoose.model<IQuestionGenUnitGlobal>('QuestionGenUnitGlobal', unitGlobalSchema);
