import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
	insert: vi.fn(),
	values: vi.fn(),
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	orderBy: vi.fn(),
	limit: vi.fn(),
	execute: vi.fn()
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({ insert: mocks.insert, select: mocks.select, execute: mocks.execute })
}));

import {
	getRecentTopics,
	getRecentTopicsByBucket,
	recordRecentTopic
} from '#lib/question-bank/recent-topic.server.js';

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
			course: 'AP Biology',
			unit: 'Unit 4',
			topicsCovered: ' Cell signaling '
		});

		expect(mocks.values).toHaveBeenCalledWith(
			expect.objectContaining({ kind: 'frq', topicsCovered: 'Cell signaling' })
		);
	});

	it('requires a kind when reading recent topics', async () => {
		await expect(
			getRecentTopics({ kind: 'mcq', course: 'AP Biology', unit: 'Unit 4' })
		).resolves.toEqual(['Cell signaling']);
		expect(mocks.where).toHaveBeenCalledOnce();
	});

	it('returns immediately for an empty bucket set', async () => {
		await expect(getRecentTopicsByBucket([])).resolves.toEqual(new Map());
		expect(mocks.execute).not.toHaveBeenCalled();
	});

	it('loads recent topics for many buckets in one partitioned query', async () => {
		mocks.execute.mockResolvedValueOnce({
			rows: [
				{
					kind: 'mcq',
					course: 'AP Biology',
					unit: 'Unit 1',
					topicsCovered: 'Photosynthesis'
				},
				{
					kind: 'mcq',
					course: 'AP Biology',
					unit: 'Unit 1',
					topicsCovered: 'Respiration'
				},
				{
					kind: 'frq',
					course: 'AP Biology',
					unit: 'All Units',
					topicsCovered: 'Evolution'
				}
			]
		});

		const result = await getRecentTopicsByBucket([
			{ kind: 'mcq', course: 'AP Biology', unit: 'Unit 1' },
			{ kind: 'mcq', course: 'AP Biology', unit: 'Unit 1' },
			{ kind: 'frq', course: 'AP Biology', unit: 'All Units' },
			{ kind: 'mcq', course: 'AP Biology', unit: 'Unit 2' }
		]);

		expect(mocks.execute).toHaveBeenCalledOnce();
		const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
		expect(query.sql.toLowerCase()).toContain('row_number()');
		expect(query.sql.toLowerCase()).toContain('partition by');
		expect(query.params).toEqual(
			expect.arrayContaining(['mcq', 'frq', 'AP Biology', 'Unit 1', 'Unit 2', 'All Units', 20])
		);
		expect(result.get('mcq\u0000AP Biology\u0000Unit 1')).toEqual([
			'Photosynthesis',
			'Respiration'
		]);
		expect(result.get('frq\u0000AP Biology\u0000All Units')).toEqual(['Evolution']);
		expect(result.get('mcq\u0000AP Biology\u0000Unit 2')).toEqual([]);
	});
});
