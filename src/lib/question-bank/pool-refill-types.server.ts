export type PoolRefillQuestionType = 'mcq' | 'frq';
export type PoolRefillStatus = 'pending' | 'running' | 'idle' | 'failed' | 'budget_exhausted';

export interface PoolRefillState {
	id: string;
	questionType: PoolRefillQuestionType;
	apClass: string;
	unit: string;
	status: PoolRefillStatus;
	target: number;
	observedCount: number;
	requestedAt: Date;
	leaseOwner?: string | null;
	leaseExpiresAt?: Date | null;
	attempts: number;
	generatedCount: number;
	lastError?: string | null;
	nextAttemptAt?: Date | null;
	lastSuccessAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export type PoolBucketWriteLock = {
	id: string;
	questionType: PoolRefillQuestionType;
	apClass: string;
	unit: string;
	leaseOwner?: string | null;
	leaseExpiresAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
};
