import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	insert: vi.fn(),
	values: vi.fn(),
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	orderBy: vi.fn(),
	limit: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ insert: mocks.insert, select: mocks.select })
}));

import { getRecentTopics, recordRecentTopic } from '$lib/question-bank/recent-topic.server';

describe('recent question topics', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.insert.mockReturnValue({ values: mocks.values });
		mocks.values.mockResolvedValue(undefined);
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
		mocks.orderBy.mockReturnValue({ limit: mocks.limit });
		mocks.limit.mockResolvedValue([{ topicsCovered: 'Cell signaling' }]);
	});

	it('persists the question kind with every recent topic', async () => {
		await recordRecentTopic({
			kind: 'frq',
			apClass: 'AP Biology',
			unit: 'Unit 4',
			topicsCovered: ' Cell signaling '
		});

		expect(mocks.values).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'frq', topicsCovered: 'Cell signaling' })
		);
	});

	it('requires a kind when reading recent topics', async () => {
		await expect(
			getRecentTopics({ kind: 'mcq', apClass: 'AP Biology', unit: 'Unit 4' })
		).resolves.toEqual(['Cell signaling']);
		expect(mocks.where).toHaveBeenCalledOnce();
	});
});
