import mongoose, { Schema, type Model } from 'mongoose';
import type {
	AiQualityAssessment,
	FeedbackSummary,
	FeedbackType,
	HumanQualityAssessment,
	QualityVerdict,
	ReviewFilters,
	ReviewJobStatus
} from './types.js';

export interface QuestionQualityDocument {
	questionId: string;
	sourceHash?: string;
	sourceEtag?: string;
	sourceCreatedAt?: Date;
	apClass?: string;
	unit?: string;
	state: 'unreviewed' | 'awaiting_human' | 'final';
	aiAssessment?: AiQualityAssessment;
	humanAssessment?: HumanQualityAssessment;
	finalVerdict?: QualityVerdict;
	finalSource?: 'ai' | 'human';
	finalizedAt?: Date;
	needsHumanReview: boolean;
	humanReviewReason?: string;
	blindHumanReview: boolean;
	feedbackSummary: FeedbackSummary;
	audit: Array<{
		at: Date;
		actorId: string;
		action: string;
		fromVerdict?: QualityVerdict;
		toVerdict?: QualityVerdict;
		note?: string;
	}>;
	createdAt: Date;
	updatedAt: Date;
}

const feedbackSummarySchema = new Schema<FeedbackSummary>(
	{
		answerIncorrect: { type: Number, default: 0 },
		questionUnclear: { type: Number, default: 0 },
		explanationUnclear: { type: Number, default: 0 },
		uniqueReporters: { type: Number, default: 0 },
		priority: { type: String, enum: ['none', 'normal', 'high'], default: 'none' }
	},
	{ _id: false }
);

const questionQualitySchema = new Schema<QuestionQualityDocument>(
	{
		questionId: { type: String, required: true, unique: true, index: true },
		sourceHash: String,
		sourceEtag: String,
		sourceCreatedAt: Date,
		apClass: { type: String, index: true },
		unit: { type: String, index: true },
		state: {
			type: String,
			enum: ['unreviewed', 'awaiting_human', 'final'],
			default: 'unreviewed',
			index: true
		},
		aiAssessment: { type: Schema.Types.Mixed },
		humanAssessment: { type: Schema.Types.Mixed },
		finalVerdict: { type: String, enum: ['good', 'bad'], index: true },
		finalSource: { type: String, enum: ['ai', 'human'] },
		finalizedAt: Date,
		needsHumanReview: { type: Boolean, default: false, index: true },
		humanReviewReason: String,
		blindHumanReview: { type: Boolean, default: false },
		feedbackSummary: { type: feedbackSummarySchema, default: () => ({}) },
		audit: {
			type: [
				new Schema(
					{
						at: { type: Date, required: true },
						actorId: { type: String, required: true },
						action: { type: String, required: true },
						fromVerdict: { type: String, enum: ['good', 'bad'] },
						toVerdict: { type: String, enum: ['good', 'bad'] },
						note: String
					},
					{ _id: false }
				)
			],
			default: []
		}
	},
	{ timestamps: true }
);

export const QuestionQuality: Model<QuestionQualityDocument> =
	(mongoose.models.QuestionQuality as Model<QuestionQualityDocument>) ??
	mongoose.model<QuestionQualityDocument>(
		'QuestionQuality',
		questionQualitySchema,
		'question_quality'
	);

export interface QuestionFeedbackDocument {
	questionId: string;
	userId: string;
	type: FeedbackType;
	apClass?: string;
	unit?: string;
	createdAt: Date;
	updatedAt: Date;
}

const questionFeedbackSchema = new Schema<QuestionFeedbackDocument>(
	{
		questionId: { type: String, required: true, index: true },
		userId: { type: String, required: true },
		type: {
			type: String,
			required: true,
			enum: ['answer_incorrect', 'question_unclear', 'explanation_unclear']
		},
		apClass: String,
		unit: String
	},
	{ timestamps: true }
);
questionFeedbackSchema.index({ questionId: 1, userId: 1, type: 1 }, { unique: true });

export const QuestionFeedback: Model<QuestionFeedbackDocument> =
	(mongoose.models.QuestionFeedback as Model<QuestionFeedbackDocument>) ??
	mongoose.model<QuestionFeedbackDocument>(
		'QuestionFeedback',
		questionFeedbackSchema,
		'question_quality_feedback'
	);

export interface ReviewJobDocument {
	status: ReviewJobStatus;
	filters: ReviewFilters;
	selectedQuestionIds: string[];
	selectedCount: number;
	skippedCount: number;
	queuedCount: number;
	submittedCount: number;
	awaitingHumanCount: number;
	finalCount: number;
	failedCount: number;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedMaximumCostUsd: number;
	actualCostUsd: number;
	model: string;
	rubricVersion: string;
	calibrated: boolean;
	createdBy: string;
	expiresAt?: Date;
	activeBatchId?: string;
	activeInputFileId?: string;
	activeOutputFileId?: string;
	activeSubmissionKey?: string;
	batches: Array<{
		submissionKey: string;
		inputFileId: string;
		batchId?: string;
		status: string;
		outputFileId?: string;
		errorFileId?: string;
		createdAt: Date;
		completedAt?: Date;
	}>;
	processingLeaseUntil?: Date;
	submissionLeaseUntil?: Date;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

const reviewJobSchema = new Schema<ReviewJobDocument>(
	{
		status: {
			type: String,
			required: true,
			enum: [
				'preview',
				'preparing',
				'in_progress',
				'paused',
				'awaiting_human',
				'completed',
				'cancelled',
				'failed'
			],
			index: true
		},
		filters: { type: Schema.Types.Mixed, required: true },
		selectedQuestionIds: { type: [String], default: [] },
		selectedCount: { type: Number, default: 0 },
		skippedCount: { type: Number, default: 0 },
		queuedCount: { type: Number, default: 0 },
		submittedCount: { type: Number, default: 0 },
		awaitingHumanCount: { type: Number, default: 0 },
		finalCount: { type: Number, default: 0 },
		failedCount: { type: Number, default: 0 },
		estimatedInputTokens: { type: Number, default: 0 },
		estimatedOutputTokens: { type: Number, default: 0 },
		estimatedMaximumCostUsd: { type: Number, default: 0 },
		actualCostUsd: { type: Number, default: 0 },
		model: { type: String, required: true },
		rubricVersion: { type: String, required: true },
		calibrated: { type: Boolean, default: false },
		createdBy: { type: String, required: true },
		expiresAt: Date,
		activeBatchId: String,
		activeInputFileId: String,
		activeOutputFileId: String,
		activeSubmissionKey: String,
		batches: {
			type: [
				new Schema(
					{
						submissionKey: { type: String, required: true },
						inputFileId: { type: String, required: true },
						batchId: String,
						status: { type: String, required: true },
						outputFileId: String,
						errorFileId: String,
						createdAt: { type: Date, required: true },
						completedAt: Date
					},
					{ _id: false }
				)
			],
			default: []
		},
		processingLeaseUntil: Date,
		submissionLeaseUntil: Date,
		error: String
	},
	{ timestamps: true }
);

export const QuestionQualityReviewJob: Model<ReviewJobDocument> =
	(mongoose.models.QuestionQualityReviewJob as Model<ReviewJobDocument>) ??
	mongoose.model<ReviewJobDocument>(
		'QuestionQualityReviewJob',
		reviewJobSchema,
		'question_quality_review_jobs'
	);

export interface ReviewJobItemDocument {
	jobId: mongoose.Types.ObjectId;
	questionId: string;
	status: 'queued' | 'preparing' | 'submitted' | 'awaiting_human' | 'final' | 'failed';
	attempts: number;
	batchId?: string;
	submissionKey?: string;
	blind: boolean;
	requiresWebSearch: boolean;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
}

const reviewJobItemSchema = new Schema<ReviewJobItemDocument>(
	{
		jobId: { type: Schema.Types.ObjectId, required: true, index: true },
		questionId: { type: String, required: true, unique: true, index: true },
		status: {
			type: String,
			required: true,
			enum: ['queued', 'preparing', 'submitted', 'awaiting_human', 'final', 'failed'],
			index: true
		},
		attempts: { type: Number, default: 0 },
		batchId: String,
		submissionKey: String,
		blind: { type: Boolean, default: false },
		requiresWebSearch: { type: Boolean, default: true },
		error: String
	},
	{ timestamps: true }
);
reviewJobItemSchema.index({ jobId: 1, status: 1 });

export const QuestionQualityReviewJobItem: Model<ReviewJobItemDocument> =
	(mongoose.models.QuestionQualityReviewJobItem as Model<ReviewJobItemDocument>) ??
	mongoose.model<ReviewJobItemDocument>(
		'QuestionQualityReviewJobItem',
		reviewJobItemSchema,
		'question_quality_review_job_items'
	);
