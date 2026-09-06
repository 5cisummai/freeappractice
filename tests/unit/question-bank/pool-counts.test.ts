import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	from: vi.fn(),
	select: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));

import { getPoolRefillHealthCounts } from '$lib/question-bank/pool-counts.server';

describe('pool refill health counts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.select.mockReturnValue({ from: mocks.from });
	});

	it('normalizes raw Neon aggregate timestamps to Date objects', async () => {
		mocks.from.mockResolvedValue([
			{
				emptyObserved: '1',
				failedJobs: '2',
				budgetExhaustedJobs: '3',
				pendingJobs: '4',
				oldestRequestedAt: '2026-09-06T03:10:59.682Z'
			}
		]);

		const health = await getPoolRefillHealthCounts();

		expect(health).toEqual({
			emptyObserved: 1,
			failedJobs: 2,
			budgetExhaustedJobs: 3,
			pendingJobs: 4,
			oldestRequestedAt: new Date('2026-09-06T03:10:59.682Z')
		});
	});
});
