import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolRefillState } from '$lib/question-bank/pool-refill-types.server';
import { poolGenerationBudgets } from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => {
	const state = {
		activeGenerations: 0,
		completedBuckets: new Set<string>(),
		candidates: [] as PoolRefillState[],
		generationBudgetUsed: 0,
		lastLease: null as PoolRefillState | null,
		maxConcurrentGenerations: 0
	};

	return {
		db: { insert: vi.fn(), update: vi.fn(), select: vi.fn() },
		state
	};
});

vi.mock('$lib/server/neon/db', () => ({ getNeonDatabase: () => mocks.db }));
vi.mock('$lib/question-bank/pool-refill-queue.server', () => ({
	countActivePoolRowsForServing: vi.fn(async (_type: string, apClass: string, unit: string) =>
		mocks.state.completedBuckets.has(`${apClass}\u0000${unit}`) ? 1 : 0
	),
	getPoolRefillHealthCounts: vi.fn(async () => ({
		emptyObserved: 0,
		failedJobs: 0,
		budgetExhaustedJobs: 0,
		pendingJobs: 0,
		oldestRequestedAt: null
	})),
	isValidPoolBucket: vi.fn(() => true)
}));
vi.mock('$lib/question-bank/pool-capacity.server', () => ({
	writePoolBucketBelowTarget: vi.fn(
		async (_bucket: PoolRefillState, _target: number, write: () => Promise<unknown>) => ({
			status: 'written',
			value: await write()
		})
	)
}));
vi.mock('$lib/question-bank/pool-kind-worker.server', () => ({
	estimatePoolGenerationSlots: vi.fn(async () => 1),
	generatePoolQuestion: vi.fn(async (_type: string, apClass: string, unit: string) => {
		mocks.state.activeGenerations += 1;
		mocks.state.maxConcurrentGenerations = Math.max(
			mocks.state.maxConcurrentGenerations,
			mocks.state.activeGenerations
		);
		await new Promise((resolve) => setTimeout(resolve, 20));
		mocks.state.activeGenerations -= 1;
		mocks.state.completedBuckets.add(`${apClass}\u0000${unit}`);
		return { skippedDuplicate: false, generatedCount: 1 };
	})
}));
vi.mock('$lib/question-bank/pool-kinds.server', () => ({
	getPoolKindAdapter: vi.fn(() => ({ minimumGenerationHeadroomMs: 0 }))
}));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('$lib/server/question-request-metrics', () => ({
	captureQuestionPoolHealthMetric: vi.fn()
}));

import { runQuestionPoolRefillWorker } from '$lib/question-bank/pool-refill.server';
import type { QuestionPoolConfig } from '$lib/question-bank/pool-constants';

const env: QuestionPoolConfig = {
	mcqTarget: 1,
	frqTarget: 1,
	lowWaterRatio: 0.9,
	leaseTtlMs: 120_000,
	retryDelayMs: 60_000,
	dailyLlmGenerationBudget: 8,
	warmingRetryAfterSeconds: 15,
	workerTimeBudgetMs: 5_000
};

function makeJob(index: number): PoolRefillState {
	const now = new Date();
	return {
		id: `job-${index}`,
		questionType: 'mcq',
		apClass: 'AP Biology',
		unit: `Unit ${index}`,
		status: 'pending',
		target: 1,
		observedCount: 0,
		requestedAt: now,
		leaseOwner: null,
		leaseExpiresAt: null,
		attempts: 0,
		generatedCount: 0,
		lastError: null,
		lastSuccessAt: null,
		nextAttemptAt: null,
		createdAt: now,
		updatedAt: now
	};
}

function configureDatabase() {
	mocks.state.activeGenerations = 0;
	mocks.state.completedBuckets.clear();
	mocks.state.candidates = Array.from({ length: 8 }, (_, index) => makeJob(index + 1));
	mocks.state.generationBudgetUsed = 0;
	mocks.state.lastLease = null;
	mocks.state.maxConcurrentGenerations = 0;

	mocks.db.insert.mockImplementation(() => ({
		values: () => ({ onConflictDoNothing: async () => undefined })
	}));
	mocks.db.select.mockImplementation(() => ({
		from: (table: unknown) => {
			const query: Record<string, unknown> = {};
			query.where = () => query;
			query.orderBy = () => query;
			query.limit = async () =>
				table === poolGenerationBudgets
					? [{ generations: mocks.state.generationBudgetUsed }]
					: mocks.state.candidates.length > 0
						? [mocks.state.candidates[0]]
						: [];
			return query;
		}
	}));
	mocks.db.update.mockImplementation((table: unknown) => {
		const query: Record<string, unknown> = {};
		query.set = () => query;
		query.where = () => query;
		query.returning = async () => {
			if (table === poolGenerationBudgets) {
				mocks.state.generationBudgetUsed += 1;
				return [{ dayKey: 'test-day' }];
			}

			if (mocks.state.candidates.length > 0) {
				const candidate = mocks.state.candidates.shift()!;
				mocks.state.lastLease = {
					...candidate,
					status: 'running',
					leaseOwner: 'worker-test',
					leaseExpiresAt: new Date(),
					attempts: candidate.attempts + 1
				};
			}
			return mocks.state.lastLease ? [mocks.state.lastLease] : [];
		};
		return query;
	});
}

describe('question pool refill worker concurrency', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configureDatabase();
	});

	it('processes up to eight refill jobs concurrently', async () => {
		const summary = await runQuestionPoolRefillWorker(env, {
			owner: 'worker-test',
			startedAt: Date.now()
		});

		expect(summary.processed).toBe(8);
		expect(summary.generated).toBe(8);
		expect(summary.budgetRemaining).toBe(0);
		expect(mocks.state.maxConcurrentGenerations).toBe(8);
	});
});
