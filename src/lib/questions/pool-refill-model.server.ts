import { randomUUID } from 'node:crypto';
import {
	poolBucketWriteLocks,
	poolGenerationBudgets,
	poolRefillStates
} from '$lib/server/neon/schema';
import { model, type PostgresModel } from '$lib/server/neon/model';

export type PoolRefillQuestionType = 'mcq' | 'frq';
export type PoolRefillStatus = 'pending' | 'running' | 'idle' | 'failed' | 'budget_exhausted';

type DocumentFields = { _id: string; save: () => Promise<unknown> };

export interface IPoolRefillState extends DocumentFields {
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

export interface IPoolBucketWriteLock extends DocumentFields {
	questionType: PoolRefillQuestionType;
	apClass: string;
	unit: string;
	leaseOwner?: string | null;
	leaseExpiresAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface IPoolGenerationBudget extends DocumentFields {
	dayKey: string;
	generations: number;
	createdAt: Date;
	updatedAt: Date;
}

export const PoolRefillState: PostgresModel<IPoolRefillState> = model<IPoolRefillState>({
	table: poolRefillStates as any,
	columns: poolRefillStates as any,
	idField: 'id',
	prepareInsert: async (input) => ({
		...input,
		id: input.id ?? randomUUID(),
		requestedAt: input.requestedAt ?? new Date(),
		status: input.status ?? 'pending',
		observedCount: input.observedCount ?? 0,
		attempts: input.attempts ?? 0,
		generatedCount: input.generatedCount ?? 0
	})
});

export const PoolBucketWriteLock: PostgresModel<IPoolBucketWriteLock> = model<IPoolBucketWriteLock>(
	{
		table: poolBucketWriteLocks as any,
		columns: poolBucketWriteLocks as any,
		idField: 'id',
		prepareInsert: async (input) => ({ ...input, id: input.id ?? randomUUID() })
	}
);

export const PoolGenerationBudget: PostgresModel<IPoolGenerationBudget> =
	model<IPoolGenerationBudget>({
		table: poolGenerationBudgets as any,
		columns: poolGenerationBudgets as any,
		idField: 'dayKey',
		prepareInsert: async (input) => ({ ...input, generations: input.generations ?? 0 })
	});
