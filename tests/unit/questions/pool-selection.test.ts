import { beforeEach, describe, expect, it, vi } from 'vitest';

const { countActivePoolRows } = vi.hoisted(() => ({ countActivePoolRows: vi.fn() }));

vi.mock('$lib/questions/pool-counts.server', () => ({ countActivePoolRows }));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { createQuestionPool, selectRandomActiveDoc } from '$lib/questions/pool.server';
import { QUESTION_POOL_CONFIG } from '$lib/questions/pool-constants';

type FakeDoc = { _id: { toString(): string }; questionId: string; randomKey: number };

function createFakeModel(docs: FakeDoc[]) {
	return {
		findOne(
			filter: Record<string, unknown>,
			_projection?: Record<string, 0 | 1> | null,
			options?: { sort?: Record<string, 1 | -1> }
		) {
			const randomKey = filter.randomKey as { $gte?: number; $lt?: number } | undefined;
			const excluded = (filter.questionId as { $nin?: string[] } | undefined)?.$nin ?? [];

			let matched = docs.filter((doc) => {
				if (excluded.includes(doc.questionId)) return false;
				if (randomKey?.$gte !== undefined && !(doc.randomKey >= randomKey.$gte)) return false;
				if (randomKey?.$lt !== undefined && !(doc.randomKey < randomKey.$lt)) return false;
				return true;
			});

			const sortDir = options?.sort?.randomKey ?? 1;
			matched = matched.sort((a, b) => (a.randomKey - b.randomKey) * sortDir);
			const hit = matched[0] ?? null;
			return { lean: async () => hit };
		},
		async countDocuments() {
			return docs.length;
		}
	};
}

describe('selectRandomActiveDoc', () => {
	const docs: FakeDoc[] = [
		{ _id: { toString: () => '1' }, questionId: 'a', randomKey: 0.1 },
		{ _id: { toString: () => '2' }, questionId: 'b', randomKey: 0.4 },
		{ _id: { toString: () => '3' }, questionId: 'c', randomKey: 0.8 }
	];

	it('selects the first doc with randomKey >= pivot', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: [],
			projection: { questionId: 1, randomKey: 1 },
			pivot: 0.35
		});
		expect(hit?.questionId).toBe('b');
	});

	it('wraps around when no doc has randomKey >= pivot', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: [],
			projection: { questionId: 1, randomKey: 1 },
			pivot: 0.95
		});
		expect(hit?.questionId).toBe('a');
	});

	it('honors exclusion list on both pivot passes', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: ['a', 'b'],
			projection: { questionId: 1, randomKey: 1 },
			pivot: 0.95
		});
		expect(hit?.questionId).toBe('c');
	});

	it('returns null when every active id is excluded', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: ['a', 'b', 'c'],
			projection: { questionId: 1, randomKey: 1 },
			pivot: 0.2
		});
		expect(hit).toBeNull();
	});
});

describe('createQuestionPool selection boundary', () => {
	beforeEach(() => {
		countActivePoolRows.mockReset();
		countActivePoolRows.mockResolvedValue(0);
	});

	it('returns warming for an empty bucket and requests refill', async () => {
		const requestRefill = vi.fn(async () => {});
		const model = {
			findOne: vi.fn(() => ({ lean: async () => null })),
			countDocuments: vi.fn(async () => 0)
		};
		const pool = createQuestionPool({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			model,
			projection: { questionId: 1 },
			serveCached: async (doc) => ({ cached: true, questionId: doc.questionId }),
			requestRefill
		});

		const outcome = await pool.getQuestion('AP Biology', 'Unit 1');
		expect(outcome).toEqual({
			status: 'warming',
			retryAfterSeconds: QUESTION_POOL_CONFIG.warmingRetryAfterSeconds
		});
		expect(requestRefill).toHaveBeenCalledWith('AP Biology', 'Unit 1');
	});

	it('resets exclusions when the bucket still has active rows', async () => {
		const docs: FakeDoc[] = [{ _id: { toString: () => '1' }, questionId: 'keep', randomKey: 0.5 }];
		const model = createFakeModel(docs);
		countActivePoolRows.mockResolvedValue(1);
		const pool = createQuestionPool({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			model,
			projection: { questionId: 1 },
			serveCached: async (doc) => ({ cached: true, questionId: doc.questionId })
		});

		const outcome = await pool.getQuestion('AP Biology', 'Unit 1', {
			excludeQuestionIds: ['keep']
		});
		expect(outcome.status).toBe('found');
		if (outcome.status === 'found') {
			expect(outcome.exclusionsReset).toBe(true);
			expect(outcome.result.questionId).toBe('keep');
		}
	});

	it('returns failed when the pool query is unavailable', async () => {
		const pool = createQuestionPool({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			model: {
				findOne: vi.fn(() => ({
					lean: async () => {
						throw new Error('db down');
					}
				}))
			},
			projection: { questionId: 1 },
			serveCached: async () => ({ cached: true, questionId: '' })
		});

		const outcome = await pool.getQuestion('AP Biology', 'Unit 1');
		expect(outcome.status).toBe('failed');
	});
});
