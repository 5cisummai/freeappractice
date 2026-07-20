import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOneAndUpdate, updateOne, countDocuments } = vi.hoisted(() => ({
	findOneAndUpdate: vi.fn(() => ({ exec: async () => ({}) })),
	updateOne: vi.fn(() => ({ exec: async () => ({}) })),
	countDocuments: vi.fn()
}));

vi.mock('$env/static/private', () => ({
	DATABASE_URI: 'mongodb://localhost/test',
	CRON_SECRET: 'test'
}));

vi.mock('$lib/server/db', () => ({
	connectDb: vi.fn(async () => ({}))
}));

vi.mock('$lib/questions/cache-model.server', () => ({
	Question: { countDocuments }
}));

vi.mock('$lib/frq/model.server', () => ({
	FrqQuestionModel: { countDocuments: vi.fn() }
}));

vi.mock('$lib/questions/pool-refill-model.server', () => ({
	PoolRefillState: {
		findOneAndUpdate,
		updateOne
	}
}));

vi.mock('$lib/catalog/ap-classes', () => ({
	getCourses: () => [],
	getUnitsForClass: () => []
}));

vi.mock('$lib/frq/profiles.server', () => ({
	getFrqCourseNames: () => []
}));

import { requestPoolRefill } from '$lib/questions/pool-refill-queue.server';
import type { QuestionPoolConfig } from '$lib/questions/pool-constants';

const env: QuestionPoolConfig = {
	mcqTarget: 10,
	frqTarget: 5,
	lowWaterRatio: 0.9,
	maxGenerationsPerRun: 5,
	leaseTtlMs: 120_000,
	retryDelayMs: 60_000,
	dailyLlmGenerationBudget: 100,
	warmingRetryAfterSeconds: 15,
	workerTimeBudgetMs: 50_000
};

describe('requestPoolRefill lease safety', () => {
	beforeEach(() => {
		findOneAndUpdate.mockClear();
		updateOne.mockClear();
		countDocuments.mockReset();
	});

	it('never $sets status in the count-refresh upsert', async () => {
		countDocuments.mockResolvedValue(0);

		await requestPoolRefill(
			{ questionType: 'mcq', apClass: 'AP Biology', unit: 'Unit 1' },
			env
		);

		const upsertUpdate = findOneAndUpdate.mock.calls[0]?.[1] as {
			$set: Record<string, unknown>;
			$setOnInsert: Record<string, unknown>;
		};
		expect(upsertUpdate.$set).toEqual({
			target: 10,
			observedCount: 0,
			requestedAt: expect.any(Date)
		});
		expect(upsertUpdate.$set).not.toHaveProperty('status');
		expect(upsertUpdate.$setOnInsert.status).toBe('pending');
	});

	it('promotes to pending only when lease is not live', async () => {
		countDocuments.mockResolvedValue(2);

		await requestPoolRefill(
			{ questionType: 'mcq', apClass: 'AP Biology', unit: 'Unit 1' },
			env
		);

		expect(updateOne).toHaveBeenCalled();
		const filter = updateOne.mock.calls[0]?.[0] as {
			$or: Array<Record<string, unknown>>;
		};
		expect(filter.$or).toEqual(
			expect.arrayContaining([
				{ status: { $in: ['idle', 'failed', 'budget_exhausted', 'pending'] } },
				{ status: 'running', leaseExpiresAt: null },
				{ status: 'running', leaseExpiresAt: { $lte: expect.any(Date) } }
			])
		);
		const update = updateOne.mock.calls[0]?.[1] as { $set: { status: string } };
		expect(update.$set.status).toBe('pending');
	});
});
