import type { AppFeedbackCategory } from '$lib/schemas/app-feedback';
import type { BugReportSeverity } from '$lib/schemas/bug-report';

export type AdminTab = 'users' | 'cache' | 'quality' | 'super' | 'feedback';

export type PoolQuestionType = 'mcq' | 'frq';

export type PoolRefillStatusUi =
	'pending' | 'running' | 'idle' | 'failed' | 'budget_exhausted' | 'unknown';

export interface AdminUserRow {
	id: string;
	name?: string | null;
	email?: string | null;
	emailVerified?: boolean;
	role?: string | string[] | null;
	banned?: boolean | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
	plan: 'free' | 'super';
	hasAdminGrant: boolean;
}

export interface AdminFeedbackItem {
	id: string;
	source: 'sidebar' | 'bug_report';
	createdAt: Date | string;
	userId?: string | null;
	userName?: string | null;
	userEmail?: string | null;
	category?: AppFeedbackCategory;
	message?: string;
	title?: string;
	description?: string;
	steps?: string | null;
	expected?: string | null;
	severity?: BugReportSeverity;
	reporterEmail?: string | null;
	metadata?: Record<string, unknown>;
}

export interface CacheOverview {
	mcqTarget: number;
	frqTarget: number;
	totalQuestions: number;
	totalTarget: number;
	totalDeficit: number;
	readinessPercent: number;
	estimatedRemainingCostUsd: number;
	totalBuckets: number;
	healthyBuckets: number;
	underTargetBuckets: number;
	emptyBuckets: number;
	pendingRefills: number;
	runningRefills: number;
	failedRefills: number;
}

export interface CacheBucketSummary {
	questionType: PoolQuestionType;
	apClass: string;
	unit: string;
	/** Active reusable questions in the serving pool. */
	total: number;
	activeCount: number;
	target: number;
	deficit: number;
	oldestCreatedAt?: Date | string | null;
	newestCreatedAt?: Date | string | null;
	fillRatio: number;
	health: 'healthy' | 'low' | 'empty';
	refillStatus: PoolRefillStatusUi;
	lastSuccessAt?: Date | string | null;
	lastError?: string | null;
	estimatedRemainingCostUsd: number;
}
