import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
	insertValues: null as unknown,
	updateSets: [] as unknown[],
	updateWheres: [] as SQL[],
	returningRows: [] as Array<{ questionType: string; course: string; unit: string }>
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		insert: () => ({
			values: (values: unknown) => {
				mocks.insertValues = values;
				return { onConflictDoNothing: async () => undefined };
			}
		}),
		update: () => ({
			set: (values: unknown) => {
				mocks.updateSets.push(values);
				return {
					where: (predicate: SQL) => {
						mocks.updateWheres.push(predicate);
						const result = Promise.resolve(mocks.returningRows);
						return Object.assign(result, {
							returning: async () => mocks.returningRows
						});
					}
				};
			}
		})
	})
}));
vi.mock('#lib/question-bank/pool-refill-queue.server.js', () => ({
	countActivePoolRowsForServing: vi.fn(async () => 0)
}));

import {
	acquirePoolBucketWriteLocks,
	releasePoolBucketWriteLocks
} from '#lib/question-bank/pool-capacity.server.js';

const buckets = [
	{ questionType: 'mcq' as const, course: 'AP Biology', unit: 'Unit 1' },
	{ questionType: 'mcq' as const, course: 'AP Biology', unit: 'Unit 2' },
	{ questionType: 'frq' as const, course: 'AP Biology', unit: 'Unit 1' }
];

describe('batched pool write locks', () => {
	beforeEach(() => {
		mocks.insertValues = null;
		mocks.updateSets = [];
		mocks.updateWheres = [];
		mocks.returningRows = buckets.map(({ questionType, course, unit }) => ({
			questionType,
			course,
			unit
		}));
	});

	it('does not query when no buckets are supplied', async () => {
		await expect(acquirePoolBucketWriteLocks([], 'worker-1')).resolves.toEqual([]);
		await expect(releasePoolBucketWriteLocks([], 'worker-1')).resolves.toBeUndefined();
		expect(mocks.insertValues).toBeNull();
		expect(mocks.updateWheres).toEqual([]);
	});

	it('inserts and acquires many buckets in one statement each', async () => {
		const acquired = await acquirePoolBucketWriteLocks([...buckets, buckets[0]!], 'worker-1');

		expect(acquired).toEqual(buckets);
		expect(mocks.insertValues).toEqual(
			expect.arrayContaining(buckets.map((bucket) => expect.objectContaining(bucket)))
		);
		expect(mocks.insertValues).toHaveLength(3);
		expect(mocks.updateSets).toHaveLength(1);
		expect(mocks.updateSets[0]).toEqual(expect.objectContaining({ leaseOwner: 'worker-1' }));
		expect(mocks.updateWheres).toHaveLength(1);
		const query = new PgDialect().sqlToQuery(mocks.updateWheres[0]!);
		expect(query.params).toEqual(
			expect.arrayContaining(['mcq', 'frq', 'AP Biology', 'Unit 1', 'Unit 2'])
		);
		expect(query.sql).toContain('question_type');
		expect(query.sql).toContain('lease_owner');
	});

	it('releases acquired buckets in one statement', async () => {
		await releasePoolBucketWriteLocks(buckets, 'worker-1');

		expect(mocks.insertValues).toBeNull();
		expect(mocks.updateSets).toEqual([{ leaseOwner: null, leaseExpiresAt: null }]);
		expect(mocks.updateWheres).toHaveLength(1);
		const query = new PgDialect().sqlToQuery(mocks.updateWheres[0]!);
		expect(query.params).toEqual(
			expect.arrayContaining(['mcq', 'frq', 'AP Biology', 'Unit 1', 'Unit 2', 'worker-1'])
		);
	});
});
