export type AdminTab = 'overview' | 'users' | 'cache' | 'generation';

export interface AdminUserRow {
	id: string;
	name?: string | null;
	email?: string | null;
	role?: string | string[] | null;
	banned?: boolean | null;
	createdAt?: Date | string | null;
	updatedAt?: Date | string | null;
}

export interface CacheOverview {
	targetPoolSize: number;
	totalQuestions: number;
	totalBuckets: number;
	healthyBuckets: number;
	underTargetBuckets: number;
	emptyBuckets: number;
	activeLocks: number;
	activeMissLocks: number;
}

export interface CacheBucketSummary {
	apClass: string;
	unit: string;
	total: number;
	oldestCreatedAt?: Date | string | null;
	newestCreatedAt?: Date | string | null;
	fillRatio: number;
	health: 'healthy' | 'low' | 'empty';
}

export interface CacheLockSnapshot {
	key: string;
	type: 'miss' | 'other';
	apClass: string;
	unit: string;
	expiresAt: Date | string;
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
