import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Shared pool metadata for slim (S3-backed) and legacy (inline) docs. */
interface IPoolDocMetadata {
	apClass: string;
	unit: string;
	topicsCovered?: string;
	lastServedAt: Date | null;
	status: 'available' | 'serving' | 'retired' | 'generating';
	serveCount: number;
	maxServeCount: number;
	lockedUntil: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

/** Post-migration shape — canonical body lives in S3. */
export type SlimQuestionDoc = IPoolDocMetadata & {
	s3QuestionId: string;
	contentHash: string;
};

/** Pre-migration shape — body may still be inline in Mongo. */
export type LegacyQuestionDoc = IPoolDocMetadata & {
	question: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	correctAnswer: 'A' | 'B' | 'C' | 'D';
	explanation: string;
	contentHash?: string;
};

/**
 * Cache pool document. During migration, docs may be slim (S3-backed) or legacy (inline body).
 * Use `hasS3BackedBody()` / `hasLegacyInlineBody()` to narrow.
 */
export interface IQuestion extends Document, IPoolDocMetadata {
	s3QuestionId?: string;
	contentHash?: string;
	question?: string;
	optionA?: string;
	optionB?: string;
	optionC?: string;
	optionD?: string;
	correctAnswer?: 'A' | 'B' | 'C' | 'D';
	explanation?: string;
}

export function hasS3BackedBody(doc: Pick<IQuestion, 's3QuestionId'>): doc is IQuestion & SlimQuestionDoc {
	return typeof doc.s3QuestionId === 'string' && doc.s3QuestionId.length > 0;
}

export function hasLegacyInlineBody(
	doc: Pick<IQuestion, 's3QuestionId' | 'question'>
): doc is IQuestion & LegacyQuestionDoc {
	return !hasS3BackedBody(doc) && typeof doc.question === 'string' && doc.question.length > 0;
}

const questionSchema = new Schema<IQuestion>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true, default: 'all-units' },
		s3QuestionId: { type: String, index: true },
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
		lockedUntil: { type: Date, default: null },
		question: { type: String },
		optionA: { type: String },
		optionB: { type: String },
		optionC: { type: String },
		optionD: { type: String },
		correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'] },
		explanation: { type: String }
	},
	{ timestamps: true }
);

questionSchema.index({ apClass: 1, unit: 1, status: 1, lastServedAt: 1 });
questionSchema.index({ contentHash: 1 }, { unique: true, sparse: true });
questionSchema.index({ s3QuestionId: 1 }, { unique: true, sparse: true });

export const Question: Model<IQuestion> =
	(mongoose.models.Question as Model<IQuestion>) ??
	mongoose.model<IQuestion>('Question', questionSchema);
