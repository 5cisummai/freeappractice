import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Shared pool metadata. */
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
};

/** @deprecated Pre-migration slim pool entry — body in S3 via s3QuestionId. */
export type SlimPoolDoc = IPoolDocMetadata & {
	s3QuestionId: string;
	contentHash: string;
};

/**
 * MongoDB hot question cache. Full MCQ inline for fast serves, with S3 written
 * once by the shared generation path before a doc enters the pool.
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

export function hasHotPoolBody(
	doc: Pick<
		IQuestion,
		'question' | 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'correctAnswer' | 'explanation'
	>
): doc is IQuestion & HotPoolDoc {
	return Boolean(
		doc.question &&
			doc.optionA &&
			doc.optionB &&
			doc.optionC &&
			doc.optionD &&
			doc.correctAnswer &&
			doc.explanation
	);
}

export function hasPersistedS3Id(
	doc: Pick<IQuestion, 's3QuestionId'>
): doc is IQuestion & { s3QuestionId: string } {
	return typeof doc.s3QuestionId === 'string' && doc.s3QuestionId.length > 0;
}

/** @deprecated Slim pool docs without inline body — body fetched from S3 only. */
export function hasS3OnlyBody(doc: IQuestion): doc is IQuestion & SlimPoolDoc {
	return hasPersistedS3Id(doc) && !hasHotPoolBody(doc);
}

const questionSchema = new Schema<IQuestion>(
	{
		apClass: { type: String, required: true },
		unit: { type: String, required: true, default: 'all-units' },
		contentHash: { type: String },
		topicsCovered: { type: String },
		question: { type: String },
		optionA: { type: String },
		optionB: { type: String },
		optionC: { type: String },
		optionD: { type: String },
		correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'] },
		explanation: { type: String },
		s3QuestionId: { type: String, index: true },
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

questionSchema.index({ apClass: 1, unit: 1, status: 1, lastServedAt: 1 });
questionSchema.index({ contentHash: 1 }, { unique: true, sparse: true });
questionSchema.index({ s3QuestionId: 1 }, { unique: true, sparse: true });

export const Question: Model<IQuestion> =
	(mongoose.models.Question as Model<IQuestion>) ??
	mongoose.model<IQuestion>('Question', questionSchema);
