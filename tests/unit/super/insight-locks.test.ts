import { beforeEach, describe, expect, it, vi } from 'vitest';
import { insightReports } from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => ({
	update: vi.fn(),
	set: vi.fn(),
	where: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ update: mocks.update })
}));

import { lockInsightReports, unlockInsightReports } from '$lib/super/insight-locks.server';

describe('insight report locks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.update.mockReturnValue({ set: mocks.set });
		mocks.set.mockReturnValue({ where: mocks.where });
		mocks.where.mockResolvedValue([]);
	});

	it('uses scoped set-based updates for lock and unlock', async () => {
		const lockedAt = new Date('2026-08-09T12:00:00.000Z');

		await lockInsightReports('user-1', lockedAt);
		await unlockInsightReports('user-1');

		expect(mocks.update).toHaveBeenCalledTimes(2);
		expect(mocks.update).toHaveBeenNthCalledWith(1, insightReports);
		expect(mocks.set).toHaveBeenNthCalledWith(1, { lockedAt, updatedAt: lockedAt });
		expect(mocks.set).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ lockedAt: null, updatedAt: expect.any(Date) })
		);
	});
});
