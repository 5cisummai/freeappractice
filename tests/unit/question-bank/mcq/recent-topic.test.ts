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
		mocks.execute.mockResolvedValue({ rows: [] });
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

	it('loads recent topics for many buckets in one windowed query', async () => {
		mocks.execute.mockResolvedValueOnce({
			rows: [
				{
					kind: 'mcq',
					course: 'AP Biology',
					unit: 'Unit 1',
					topicsCovered: 'photosynthesis'
				},
				{
					kind: 'mcq',
					course: 'AP Biology',
					unit: 'Unit 1',
					topicsCovered: 'respiration'
				}
			]
		});

		const topics = await getRecentTopicsByBucket([
			{ kind: 'mcq', course: 'AP Biology', unit: 'Unit 1' },
			{ kind: 'mcq', course: 'AP Biology', unit: 'Unit 1' },
			{ kind: 'frq', course: 'AP Biology', unit: 'All Units' }
		]);

		expect(mocks.execute).toHaveBeenCalledOnce();
		const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0]?.[0] as never);
		expect(query.sql).toContain('ROW_NUMBER()');
		expect(query.sql).toContain('jsonb_to_recordset');
		expect(query.sql).toContain('PARTITION BY topic.kind, topic.course, topic.unit');
		expect(
			query.params.some((param) => typeof param === 'string' && param.includes('All Units'))
		).toBe(true);
		expect(topics.get('mcq\u0000AP Biology\u0000Unit 1')).toEqual([
			'photosynthesis',
			'respiration'
		]);
		expect(topics.get('frq\u0000AP Biology\u0000All Units')).toEqual([]);
	});
});
