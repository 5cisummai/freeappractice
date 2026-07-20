import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	findOneAndUpdate,
	updateOne,
	refillFindOne,
	budgetFindOne,
	budgetFindOneAndUpdate,
	countActivePoolRows,
	generateQuestionForPool,
	generateAndPersistFrq,
	reconcilePoolRefillJobs
} = vi.hoisted(() => ({
	findOneAndUpdate: vi.fn(),
	updateOne: vi.fn(() => ({ exec: async () => ({}) })),
	refillFindOne: vi.fn(() => ({
		sort: () => ({
			select: () => ({
				lean: async () => null
			}),
			exec: async () => null
		})
	})),
	budgetFindOne: vi.fn(),
	budgetFindOneAndUpdate: vi.fn(),
	countActivePoolRows: vi.fn(),
	generateQuestionForPool: vi.fn(),
	generateAndPersistFrq: vi.fn(),
	reconcilePoolRefillJobs: vi.fn(async () => ({ reconciled: 0, enqueued: 0 }))
}));

vi.mock('$env/static/private', () => ({
	DATABASE_URI: 'mongodb://localhost/test',
	CRON_SECRET: 'test'
}));

vi.mock('$lib/server/db', () => ({
	connectDb: vi.fn(async () => ({}))
}));

vi.mock('$lib/questions/pool-refill-model.server', () => ({
	PoolRefillState: {
		findOneAndUpdate,
		updateOne,
		findOne: refillFindOne,
		countDocuments: vi.fn(async () => 0)
	},
	PoolGenerationBudget: {
		findOne: budgetFindOne,
		findOneAndUpdate: budgetFindOneAndUpdate,
		updateOne: vi.fn(() => ({ exec: async () => ({}) }))
	}
}));

vi.mock('$lib/questions/pool-write.server', () => ({
	generateQuestionForPool
}));

vi.mock('$lib/frq/generation.server', () => ({
	generateAndPersistFrq
}));

vi.mock('$lib/questions/pool-refill-queue.server', async () => {
	const actual = await vi.importActual<typeof import('$lib/questions/pool-refill-queue.server')>(
		'$lib/questions/pool-refill-queue.server'
	);
	return {
		...actual,
		countActivePoolRows,
		reconcilePoolRefillJobs,
		requestPoolRefill: vi.fn(),
		enqueueAllCatalogDeficits: vi.fn(),
		listCatalogBuckets: vi.fn(() => [])
	};
});

vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('$lib/server/question-request-metrics', () => ({
	captureQuestionPoolHealthMetric: vi.fn()
}));

import {
	processRefillJob,
	reserveDailyGenerationBudget,
	runQuestionPoolRefillWorker,
	tryAcquireRefillLease
} from '$lib/questions/pool-refill.server';
import type { IPoolRefillState } from '$lib/questions/pool-refill-model.server';
import type { QuestionPoolConfig } from '$lib/questions/pool-constants';

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

function leasedDoc(overrides: Partial<IPoolRefillState> = {}): IPoolRefillState {
	return {
		_id: 'job-1',
		questionType: 'mcq',
		apClass: 'AP Biology',
		unit: 'Unit 1',
		status: 'running',
		target: 10,
		observedCount: 0,
		requestedAt: new Date(),
		leaseOwner: 'worker-1',
		leaseExpiresAt: new Date(Date.now() + 60_000),
		attempts: 1,
		generatedCount: 0,
		lastError: null,
		lastSuccessAt: null,
		nextAttemptAt: null,
		...overrides
	} as IPoolRefillState;
}

describe('tryAcquireRefillLease expiry', () => {
	beforeEach(() => {
		findOneAndUpdate.mockReset();
	});

	it('includes expired running leases in the acquisition filter', async () => {
		findOneAndUpdate.mockReturnValueOnce({ exec: async () => leasedDoc() });
		const now = new Date('2026-07-19T12:00:00.000Z');

		await tryAcquireRefillLease(
			{ questionType: 'mcq', apClass: 'AP Biology', unit: 'Unit 1' },
			{ owner: 'worker-1', leaseTtlMs: 120_000, now }
		);

		const filter = findOneAndUpdate.mock.calls[0]?.[0] as {
			$and: Array<{ $or?: Array<Record<string, unknown>> }>;
		};
		const leaseClause = filter.$and.find((clause) =>
			clause.$or?.some((entry) => 'leaseExpiresAt' in entry || entry.status)
		);
		expect(leaseClause?.$or).toEqual(
			expect.arrayContaining([
				{ status: { $ne: 'running' } },
				{ leaseExpiresAt: null },
				{ leaseExpiresAt: { $lte: now } }
			])
		);
	});
});

describe('daily budget enforcement', () => {
	beforeEach(() => {
		findOneAndUpdate.mockReset();
		updateOne.mockClear();
		budgetFindOne.mockReset();
		budgetFindOneAndUpdate.mockReset();
		countActivePoolRows.mockReset();
		generateQuestionForPool.mockReset();
		reconcilePoolRefillJobs.mockClear();
	});

	it('stops processRefillJob and marks budget_exhausted when daily budget is 0', async () => {
		countActivePoolRows.mockResolvedValue(0);
		budgetFindOneAndUpdate.mockReturnValue({
			exec: async () => null
		});

		const result = await processRefillJob(leasedDoc(), env, {
			maxGenerations: 5,
			deadlineMs: Date.now() + 60_000
		});

		expect(result).toEqual({
			generated: 0,
			skippedDuplicates: 0,
			failed: false,
			budgetHit: true
		});
		expect(generateQuestionForPool).not.toHaveBeenCalled();
		expect(updateOne).toHaveBeenCalled();
		const update = (updateOne.mock.calls[0] as unknown as unknown[])[1] as {
			$set: { status: string };
		};
		expect(update.$set.status).toBe('budget_exhausted');
	});

	it('returns daily_budget from the worker without leasing jobs when budget is exhausted', async () => {
		budgetFindOne.mockReturnValue({
			lean: async () => ({ dayKey: '2026-07-19', generations: 2 })
		});

		const summary = await runQuestionPoolRefillWorker(env, {
			owner: 'worker-budget',
			startedAt: Date.now()
		});

		expect(summary.stoppedReason).toBe('daily_budget');
		expect(summary.processed).toBe(0);
		expect(summary.generated).toBe(0);
		expect(summary.budgetRemaining).toBe(0);
		expect(findOneAndUpdate).not.toHaveBeenCalled();
		expect(reconcilePoolRefillJobs).not.toHaveBeenCalled();
	});

	it('consumes budget for each generation attempt including duplicates', async () => {
		countActivePoolRows.mockResolvedValueOnce(0).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
		budgetFindOneAndUpdate.mockReturnValue({
			exec: async () => ({ generations: 1 })
		});
		findOneAndUpdate.mockReturnValue({
			exec: async () => leasedDoc({ target: 1 })
		});
		generateQuestionForPool.mockResolvedValueOnce({
			skippedDuplicate: true,
			answer: {},
			questionId: 'q1'
		});

		const result = await processRefillJob(leasedDoc({ target: 1 }), env, {
			maxGenerations: 1,
			deadlineMs: Date.now() + 60_000
		});

		expect(generateQuestionForPool).toHaveBeenCalledOnce();
		expect(budgetFindOneAndUpdate).toHaveBeenCalled();
		const budgetFilter = budgetFindOneAndUpdate.mock.calls[0]?.[0] as {
			generations: { $lt: number };
		};
		expect(budgetFilter.generations.$lt).toBe(env.dailyLlmGenerationBudget);
		expect(result.skippedDuplicates).toBe(1);
		expect(result.generated).toBe(0);
		expect(result.budgetHit).toBe(false);
	});

	it('reserves a bulk daily budget amount for batch submit', async () => {
		budgetFindOne.mockReturnValue({
			lean: async () => ({ dayKey: '2026-07-19', generations: 0 })
		});
		budgetFindOneAndUpdate.mockReturnValue({
			exec: async () => ({ generations: 40 })
		});

		const reserved = await reserveDailyGenerationBudget(env, 40);
		expect(reserved).toBe(2); // capped by remaining = budget 2 - used 0
		expect(budgetFindOneAndUpdate).toHaveBeenCalled();
		const filter = budgetFindOneAndUpdate.mock.calls[0]?.[0] as {
			generations: { $lte: number };
		};
		expect(filter.generations.$lte).toBe(0); // budget 2 - toReserve 2
	});
});
