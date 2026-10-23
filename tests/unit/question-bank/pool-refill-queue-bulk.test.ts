import { beforeEach, describe, expect, it, vi } from 'vitest';

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
	});

	it('reconciles the catalog with a constant number of statements', async () => {
		const result = await reconcilePoolRefillJobs();
		expect(result).toEqual({ reconciled: catalogSize, enqueued: catalogSize });
		expect(mocks.db.execute).toHaveBeenCalledTimes(2);
		expect(mocks.db.insert).not.toHaveBeenCalled();
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
