/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { poolGenerationBudgets, poolRefillStates } from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => ({
	db: { insert: vi.fn(), update: vi.fn(), select: vi.fn() },
	queries: [] as Array<Record<string, unknown>>,
	budgetGenerations: 0
}));

vi.mock('$lib/server/neon/db', () => ({ getNeonDatabase: () => mocks.db }));
vi.mock('$lib/question-bank/pool-refill-queue.server', () => ({
	countActivePoolRows: vi.fn(async () => 0),
	getPoolRefillHealthCounts: vi.fn(async () => ({
		emptyObserved: 0,
		failedJobs: 0,
		budgetExhaustedJobs: 0,
		pendingJobs: 0,
		oldestRequestedAt: null
	}))
}));
vi.mock('$lib/question-bank/pool-capacity.server', () => ({
	writePoolBucketBelowTarget: vi.fn(
		async (_bucket: unknown, _target: number, write: () => Promise<unknown>) => ({
			status: 'written',
			value: await write()
		})
	)
}));
vi.mock('$lib/question-bank/mcq/write.server', () => ({ generateQuestionForPool: vi.fn() }));
vi.mock('$lib/question-bank/frq/generation.server', () => ({ generateAndPersistFrq: vi.fn() }));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('$lib/server/question-request-metrics', () => ({
	captureQuestionPoolHealthMetric: vi.fn()
}));

import {
	getDailyBudgetRemaining,
	releaseDailyGenerationBudget,
	reserveDailyGenerationBudget,
	tryAcquireRefillLease
} from '$lib/question-bank/pool-refill.server';
import type { PoolRefillState } from '$lib/question-bank/pool-refill-types.server';
import type { QuestionPoolConfig } from '$lib/question-bank/pool-constants';

function query(kind: string, table: unknown) {
	const value: Record<string, any> = { kind, table };
	mocks.queries.push(value);
	value.values = vi.fn(() => value);
	value.set = vi.fn(() => value);
	value.where = vi.fn(() => value);
	value.onConflictDoNothing = vi.fn(() => value);
	value.returning = vi.fn(async () => [{ dayKey: '2026-08-09' }]);
	value.limit = vi.fn(async () => [{ generations: mocks.budgetGenerations }]);
	return value;
}

const env: QuestionPoolConfig = {
	mcqTarget: 10,
	frqTarget: 5,
	lowWaterRatio: 0.9,
	maxGenerationsPerRun: 5,
	leaseTtlMs: 120_000,
	retryDelayMs: 60_000,
	dailyLlmGenerationBudget: 2,
	warmingRetryAfterSeconds: 15,
	workerTimeBudgetMs: 50_000
};

function configureDatabase() {
	mocks.queries.length = 0;
	mocks.budgetGenerations = 0;
	mocks.db.insert.mockImplementation((table: unknown) => query('insert', table));
	mocks.db.update.mockImplementation((table: unknown) => query('update', table));
	mocks.db.select.mockImplementation(() => ({
		from: (table: unknown) => ({
			where: () => ({
				limit: async () =>
					table === poolGenerationBudgets ? [{ generations: mocks.budgetGenerations }] : []
			})
		})
	}));
}

describe('direct Drizzle pool persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configureDatabase();
	});

	it('acquires a refill lease with one conditional update', async () => {
		const lease: PoolRefillState = {
			id: 'job-1',
			questionType: 'mcq',
			apClass: 'AP Biology',
			unit: 'Unit 1',
			status: 'running',
			target: 10,
			observedCount: 0,
			requestedAt: new Date(),
			leaseOwner: 'worker-1',
			leaseExpiresAt: new Date(),
			attempts: 1,
			generatedCount: 0,
			lastError: null,
			lastSuccessAt: null,
			nextAttemptAt: null,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		mocks.db.update.mockImplementationOnce(() => {
			const value = query('update', poolRefillStates);
			value.returning = vi.fn(async () => [lease]);
			return value;
		});

		const result = await tryAcquireRefillLease(
			{ questionType: 'mcq', apClass: 'AP Biology', unit: 'Unit 1' },
			{ owner: 'worker-1', leaseTtlMs: 120_000, now: new Date('2026-08-09T12:00:00Z') }
		);

		expect(result).toEqual(lease);
		expect(mocks.db.update).toHaveBeenCalledWith(poolRefillStates);
		expect(mocks.queries[0]?.valuesArg ?? mocks.queries[0]?.set).toBeDefined();
	});

	it('returns the remaining daily budget from the Drizzle row', async () => {
		mocks.budgetGenerations = 1;
		expect(await getDailyBudgetRemaining(env)).toBe(1);
		expect(mocks.db.select).toHaveBeenCalledOnce();
	});

	it('reserves and refunds slots through atomic updates', async () => {
		expect(await reserveDailyGenerationBudget(env, 2)).toBe(2);
		expect(await releaseDailyGenerationBudget(1)).toBe(1);
		expect(mocks.db.update).toHaveBeenCalledWith(poolGenerationBudgets);
	});
});
