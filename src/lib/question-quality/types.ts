export const QUESTION_QUALITY_RUBRIC_VERSION = 'ap-quality-v2';

export type QualityVerdict = 'good' | 'bad';
export type FeedbackType = 'answer_incorrect' | 'question_unclear' | 'explanation_unclear';

export type ReviewJobStatus =
	| 'preview'
	| 'preparing'
	| 'in_progress'
	| 'paused'
	| 'awaiting_human'
	| 'completed'
	| 'cancelled'
	| 'failed';

export interface ReviewFilters {
	apClass?: string;
	unit?: string;
	qualityState?: 'unreviewed' | 'awaiting_human' | 'final';
	createdAfter?: string;
	createdBefore?: string;
	minimumAgeDays?: number;
	maxCount?: number;
}

export interface QualityUsage {
	inputTokens: number;
	outputTokens: number;
	estimatedCostUsd: number;
}

export interface AiQualityAssessment {
	verdict: QualityVerdict;
	issueCodes: string[];
	evidence: string[];
	sourceUrls: string[];
	webSearchUsed: boolean;
	confidence: number;
	requiresHumanReview: boolean;
	model: string;
	rubricVersion: string;
	reviewedAt: Date | string;
	usage: QualityUsage;
}

export interface HumanQualityAssessment {
	verdict: QualityVerdict;
	notes: string;
	reviewerId: string;
	blind: boolean;
	reviewedAt: Date | string;
}

export interface FeedbackSummary {
	answerIncorrect: number;
	questionUnclear: number;
	explanationUnclear: number;
	uniqueReporters: number;
	priority: 'none' | 'normal' | 'high';
}

export interface ReviewPreview {
	previewId: string;
	filters: ReviewFilters;
	selectedCount: number;
	skippedCount: number;
	estimatedInputTokens: number;
	estimatedOutputTokens: number;
	estimatedMaximumCostUsd: number;
	model: string;
	calibrated: boolean;
	expiresAt: Date | string;
}

export interface QualityJobSummary {
	id: string;
	status: ReviewJobStatus;
	selectedCount: number;
	queuedCount: number;
	submittedCount: number;
	awaitingHumanCount: number;
	finalCount: number;
	failedCount: number;
	estimatedMaximumCostUsd: number;
	actualCostUsd: number;
	model: string;
	createdAt: Date | string;
	updatedAt: Date | string;
	error?: string | null;
}

export interface HumanReviewItem {
	questionId: string;
	apClass?: string;
	unit?: string;
	stimulus?: string;
	question?: string;
	options?: Record<string, string>;
	correctAnswer?: string;
	explanation?: string;
	reason: string;
	blind: boolean;
	aiAssessment?: AiQualityAssessment | null;
	feedbackSummary: FeedbackSummary;
}

export interface QualityDashboardSnapshot {
	counts: {
		unreviewed: number;
		awaitingHuman: number;
		good: number;
		bad: number;
		highPriority: number;
	};
	model: string;
	calibrated: boolean;
	jobs: QualityJobSummary[];
	humanQueue: HumanReviewItem[];
}
