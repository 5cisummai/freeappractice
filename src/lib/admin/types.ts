export type AdminTab = 'overview' | 'users' | 'cache' | 'generation' | 'quality';

export type PoolQuestionType = 'mcq' | 'frq';

export type PoolRefillStatusUi =
	| 'pending'
	| 'running'
	| 'idle'
	| 'failed'
	| 'budget_exhausted'
	| 'unknown';

export interface AdminUserRow {
	id: string;
	name?: string | null;
	email?: string | null;
	emailVerified?: boolean;
	role?: string | string[] | null;
	banned?: boolean | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
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

export interface RecentTopicSnapshot {
	apClass: string;
	unit: string;
	topicsCovered: string;
	createdAt: Date | string;
}

export interface GenerationOverview {
	totalQuestions: number;
	totalQuestionChars: number;
	apClassesCount: number;
	unitsCount: number;
}

export interface GenerationClassSummary {
	apClass: string;
	count: number;
	share: number;
}

export interface GenerationUnitSummary {
	apClass: string;
	unit: string;
	count: number;
}
