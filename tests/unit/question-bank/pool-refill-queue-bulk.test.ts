import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
	db: { insert: vi.fn(), update: vi.fn(), select: vi.fn(), execute: vi.fn() }
}));

vi.mock('#lib/server/neon/db.js', () => ({ getNeonDatabase: () => mocks.db }));
vi.mock('#lib/question-bank/gen-stats.server.js', () => ({
	getMcqGenerationCountsByCourse: vi.fn(async () => ({}))
}));
vi.mock('#lib/question-bank/pool-counts.server.js', () => ({
	countActivePoolRows: vi.fn(),
	countActivePoolRowsByBucket: vi.fn(),
	countActivePoolRowsForServing: vi.fn(),
	countActivePoolRowsForServingByBucket: vi.fn(),
	getPoolRefillHealthCounts: vi.fn()
}));

import { countActivePoolRowsByBucket } from '#lib/question-bank/pool-counts.server.js';
import {
	enqueueAllCatalogDeficits,
	listCatalogBuckets,
	reconcilePoolRefillJobs,
	requestPoolRefill
} from '#lib/question-bank/pool-refill-queue.server.js';

const catalogSize = listCatalogBuckets('mcq').length + listCatalogBuckets('frq').length;

function observedMap(questionType: 'mcq' | 'frq', count: number): Map<string, number> {
	return new Map(
		listCatalogBuckets(questionType).map((bucket) => [
			`${bucket.course}\u0000${bucket.unit}`,
			count
		])
	);
}

function executedSql(): Array<{ sql: string; params: unknown[] }> {
	return mocks.db.execute.mock.calls.map(([query]) => new PgDialect().sqlToQuery(query));
}

describe('pool refill catalog bulk writes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.db.execute.mockResolvedValue({ rows: [] });
		mocks.db.insert.mockReturnValue({
			values: () => ({ onConflictDoUpdate: async () => undefined })
		});
		mocks.db.update.mockReturnValue({
			set: () => ({ where: async () => undefined })
		});
		vi.mocked(countActivePoolRowsByBucket).mockImplementation(async (questionType) =>
			observedMap(questionType, 0)
		);
	});

	it('enqueues every catalog deficit with a constant number of statements', async () => {
		expect(catalogSize).toBeGreaterThan(5);
		const enqueued = await enqueueAllCatalogDeficits();
		expect(enqueued).toBe(catalogSize);
		expect(mocks.db.execute).toHaveBeenCalledTimes(2);
		expect(mocks.db.insert).not.toHaveBeenCalled();
		expect(mocks.db.update).not.toHaveBeenCalled();

		const queries = executedSql();
		expect(queries[0]?.sql).toContain('jsonb_to_recordset');
		expect(queries[0]?.sql).toContain('ON CONFLICT');
		expect(queries[0]?.sql).toContain('requested_at = EXCLUDED.requested_at');
		expect(queries[1]?.sql).toContain("status = 'pending'");
		expect(queries[1]?.sql).toContain(
			"status IN ('idle', 'failed', 'budget_exhausted', 'pending')"
		);
		expect(queries[1]?.sql).toContain('lease_expires_at IS NULL');
	});

	it('reconciles the catalog with a constant number of statements', async () => {
		const result = await reconcilePoolRefillJobs();
		expect(result).toEqual({ reconciled: catalogSize, enqueued: catalogSize });
		expect(mocks.db.execute).toHaveBeenCalledTimes(2);
		expect(mocks.db.insert).not.toHaveBeenCalled();

		const queries = executedSql();
		expect(queries[0]?.sql).toContain('ON CONFLICT');
		expect(queries[0]?.sql).not.toContain('requested_at = EXCLUDED.requested_at');
		expect(queries[1]?.sql).toContain("status = 'pending'");
	});

	it('idles a full catalog without per-bucket updates', async () => {
		vi.mocked(countActivePoolRowsByBucket).mockImplementation(async (questionType) =>
			observedMap(questionType, 10_000)
		);
		const result = await reconcilePoolRefillJobs();
		expect(result).toEqual({ reconciled: catalogSize, enqueued: 0 });
		expect(mocks.db.execute).toHaveBeenCalledTimes(2);
		expect(await enqueueAllCatalogDeficits()).toBe(0);
		expect(mocks.db.execute).toHaveBeenCalledTimes(2);
		expect(mocks.db.insert).not.toHaveBeenCalled();

		const idleQuery = executedSql().find((query) => query.sql.includes("status = 'idle'"));
		expect(idleQuery?.sql).toContain("status IN ('pending', 'failed', 'budget_exhausted')");
		expect(idleQuery?.sql).not.toContain("'idle', 'failed'");
		expect(idleQuery?.sql).toContain('lease_expires_at IS NULL');
	});

	it('uses three statements when some buckets need enqueue and others need idle', async () => {
		vi.mocked(countActivePoolRowsByBucket).mockImplementation(async (questionType) =>
			observedMap(questionType, questionType === 'mcq' ? 0 : 10_000)
		);
		const result = await reconcilePoolRefillJobs();
		expect(result.reconciled).toBe(catalogSize);
		expect(result.enqueued).toBe(listCatalogBuckets('mcq').length);
		expect(mocks.db.execute).toHaveBeenCalledTimes(3);
		const queries = executedSql();
		expect(queries.some((query) => query.sql.includes("status = 'pending'"))).toBe(true);
		expect(queries.some((query) => query.sql.includes("status = 'idle'"))).toBe(true);
	});

	it('keeps single-bucket refill requests on the row upsert path', async () => {
		await requestPoolRefill({
			questionType: 'mcq',
			course: 'AP Biology',
			unit: 'Unit 1: Chemistry of Life'
		});
		expect(mocks.db.insert).toHaveBeenCalledOnce();
		expect(mocks.db.update).toHaveBeenCalledOnce();
		expect(mocks.db.execute).not.toHaveBeenCalled();
	});
});
