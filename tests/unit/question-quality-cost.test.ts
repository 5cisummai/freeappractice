import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	from: vi.fn(),
	leftJoin: vi.fn(),
	where: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));

import { getCompletedReviewCost } from '$lib/question-quality/cost.server';

describe('question quality review cost', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ leftJoin: mocks.leftJoin });
		mocks.leftJoin.mockReturnValue({ where: mocks.where });
	});

	it('returns the finalized assessment cost as a number', async () => {
		mocks.where.mockResolvedValue([{ total: '0.42' }]);

		await expect(getCompletedReviewCost('job-1')).resolves.toBe(0.42);
		expect(mocks.leftJoin).toHaveBeenCalledOnce();
		expect(mocks.where).toHaveBeenCalledOnce();
	});

	it('returns zero when no finalized assessment has a cost', async () => {
		mocks.where.mockResolvedValue([{ total: '0' }]);

		await expect(getCompletedReviewCost('job-2')).resolves.toBe(0);
	});
});
