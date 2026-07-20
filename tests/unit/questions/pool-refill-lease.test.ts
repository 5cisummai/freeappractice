import { describe, expect, it, vi } from 'vitest';

const { findOneAndUpdate } = vi.hoisted(() => ({
	findOneAndUpdate: vi.fn()
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
		updateOne: vi.fn(),
		findOne: vi.fn()
	},
	PoolGenerationBudget: {
		findOne: vi.fn(async () => null),
		findOneAndUpdate: vi.fn(async () => ({ generations: 1 }))
	}
}));

vi.mock('$lib/questions/pool-write.server', () => ({
	generateQuestionForPool: vi.fn()
}));

vi.mock('$lib/frq/generation.server', () => ({
	generateAndPersistFrq: vi.fn()
}));

vi.mock('$lib/questions/pool-refill-queue.server', async () => {
	const actual = await vi.importActual<typeof import('$lib/questions/pool-refill-queue.server')>(
		'$lib/questions/pool-refill-queue.server'
	);
	return {
		...actual,
		countActivePoolRows: vi.fn(async () => 0),
		reconcilePoolRefillJobs: vi.fn(async () => ({ reconciled: 0, enqueued: 0 }))
	};
});

vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { tryAcquireRefillLease } from '$lib/questions/pool-refill.server';

describe('tryAcquireRefillLease', () => {
	it('acquires an expiring lease for a pending bucket', async () => {
		const leased = {
			questionType: 'mcq',
			apClass: 'AP Biology',
			unit: 'Unit 1',
			status: 'running',
			leaseOwner: 'worker-1',
			leaseExpiresAt: new Date('2026-07-19T12:02:00.000Z')
		};
		findOneAndUpdate.mockReturnValueOnce({ exec: async () => leased });

		const now = new Date('2026-07-19T12:00:00.000Z');
		const result = await tryAcquireRefillLease(
			{ questionType: 'mcq', apClass: 'AP Biology', unit: 'Unit 1' },
			{ owner: 'worker-1', leaseTtlMs: 120_000, now }
		);

		expect(result).toEqual(leased);
		expect(findOneAndUpdate).toHaveBeenCalled();
		const filter = findOneAndUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(filter).toMatchObject({
			questionType: 'mcq',
			apClass: 'AP Biology',
			unit: 'Unit 1'
		});
		const update = findOneAndUpdate.mock.calls[0]?.[1] as {
			$set: { status: string; leaseOwner: string; leaseExpiresAt: Date };
		};
		expect(update.$set.status).toBe('running');
		expect(update.$set.leaseOwner).toBe('worker-1');
		expect(update.$set.leaseExpiresAt.getTime()).toBe(now.getTime() + 120_000);
	});

	it('returns null when another worker holds a live lease', async () => {
		findOneAndUpdate.mockReturnValueOnce({ exec: async () => null });
		const result = await tryAcquireRefillLease(
			{ questionType: 'frq', apClass: 'AP Biology', unit: 'Unit 2' },
			{ owner: 'worker-2', leaseTtlMs: 60_000 }
		);
		expect(result).toBeNull();
	});
});
