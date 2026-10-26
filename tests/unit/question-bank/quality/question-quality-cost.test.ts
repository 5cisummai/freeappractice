import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	from: vi.fn(),
	leftJoin: vi.fn(),
	where: vi.fn()
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));

import { getCompletedReviewCost } from '#lib/question-bank/quality/cost.server.js';

describe('question quality review cost', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ leftJoin: mocks.leftJoin });
		mocks.leftJoin.mockReturnValue({ where: mocks.where });
	});

	it('coerces finalized assessment cost strings to numbers', async () => {
		mocks.where.mockResolvedValueOnce([{ total: '0.42' }]);
		await expect(getCompletedReviewCost('job-1')).resolves.toBe(0.42);

		mocks.where.mockResolvedValueOnce([{ total: '0' }]);
		await expect(getCompletedReviewCost('job-2')).resolves.toBe(0);
	});
});
