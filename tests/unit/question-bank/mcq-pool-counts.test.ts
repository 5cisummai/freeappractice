import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({ where: null as SQL | null }));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		select: () => ({
			from: () => ({
				where: (predicate: SQL) => ({
					groupBy: async () => {
						mocks.where = predicate;
						return [];
					}
				})
			})
		})
	})
}));

import { countActiveMcqQuestionsByBucket } from '#lib/question-bank/mcq/repository.server.js';
import { frqPoolKind } from '#lib/question-bank/frq/adapter.server.js';
import { frqPracticeFor } from '#lib/question-bank/frq/practice.js';
import { getFrqCourseNames } from '#lib/question-bank/frq/profiles.server.js';
import { countActivePoolRowsForServingByBucket } from '#lib/question-bank/pool-counts.server.js';

describe('grouped MCQ serving counts', () => {
	beforeEach(() => {
		mocks.where = null;
	});

	it('returns immediately for an empty bucket set', async () => {
		await expect(countActivePoolRowsForServingByBucket('mcq', [])).resolves.toEqual(new Map());
		expect(mocks.where).toBeNull();
	});

	it('filters the grouped query to only the supplied buckets', async () => {
		const buckets = [
			{ course: 'AP Biology', unit: 'Unit 1' },
			{ course: 'AP Biology', unit: 'Unit 2' }
		];

		await countActiveMcqQuestionsByBucket(true, buckets);

		const query = new PgDialect().sqlToQuery(mocks.where as SQL);
		expect(query.sql).toContain("->> 'course' = $");
		expect(query.sql).toContain("->> 'unit' = $");
		expect(query.params).toEqual(expect.arrayContaining(['AP Biology', 'Unit 1', 'Unit 2']));
		expect(query.params).not.toContain('AP Chemistry');
	});

	it('filters task FRQ counts by course and format bucket', async () => {
		const course = getFrqCourseNames().find((name) => frqPracticeFor(name)?.control === 'task');
		const formatId = course && frqPracticeFor(course)?.tasks[0]?.formatId;
		expect(course).toBeTruthy();
		expect(formatId).toBeTruthy();

		await frqPoolKind.countActiveByBucket([{ course: course!, unit: formatId! }]);

		const query = new PgDialect().sqlToQuery(mocks.where as SQL);
		expect(query.sql).toContain("->> 'course' = $");
		expect(query.sql).toContain("->> 'unit' = $");
		expect(query.sql).toContain("->> 'formatId' = $");
		expect(query.params).toEqual(expect.arrayContaining([course, 'All Units', formatId]));
	});
});
