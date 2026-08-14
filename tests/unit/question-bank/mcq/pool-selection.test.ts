import { beforeEach, describe, expect, it, vi } from 'vitest';

const { countActivePoolRows } = vi.hoisted(() => ({ countActivePoolRows: vi.fn() }));

vi.mock('$lib/question-bank/pool-counts.server', () => ({ countActivePoolRows }));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { QuestionBank, selectRandomActiveDoc } from '$lib/question-bank/runtime.server';
import { QUESTION_POOL_CONFIG } from '$lib/question-bank/pool-constants';

type FakeDoc = { questionId: string; randomKey: number };

function createFindRandom(docs: FakeDoc[]) {
	return async (input: {
		excludeQuestionIds: string[];
		pivot: number;
		fromPivot: 'after' | 'before';
	}) => {
		const matched = docs
			.filter((doc) => !input.excludeQuestionIds.includes(doc.questionId))
			.filter((doc) =>
				input.fromPivot === 'after' ? doc.randomKey >= input.pivot : doc.randomKey < input.pivot
			)
			.sort((a, b) => a.randomKey - b.randomKey);
		return matched[0] ?? null;
	};
}

describe('selectRandomActiveDoc', () => {
	const docs: FakeDoc[] = [
		{ questionId: 'a', randomKey: 0.1 },
		{ questionId: 'b', randomKey: 0.4 },
		{ questionId: 'c', randomKey: 0.8 }
	];

	it('selects the first doc with randomKey >= pivot', async () => {
		const hit = await selectRandomActiveDoc({
			findRandom: createFindRandom(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: [],
			pivot: 0.35
		});
		expect(hit?.questionId).toBe('b');
	});

	it('wraps around when no doc has randomKey >= pivot', async () => {
		const hit = await selectRandomActiveDoc({
			findRandom: createFindRandom(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: [],
			pivot: 0.95
		});
		expect(hit?.questionId).toBe('a');
	});

	it('honors exclusion list on both pivot passes', async () => {
		const hit = await selectRandomActiveDoc({
			findRandom: createFindRandom(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: ['a', 'b'],
			pivot: 0.95
		});
		expect(hit?.questionId).toBe('c');
	});

	it('returns null when every active id is excluded', async () => {
		const hit = await selectRandomActiveDoc({
			findRandom: createFindRandom(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: ['a', 'b', 'c'],
			pivot: 0.2
		});
		expect(hit).toBeNull();
	});
});

describe('QuestionBank selection boundary', () => {
	beforeEach(() => {
		countActivePoolRows.mockReset();
		countActivePoolRows.mockResolvedValue(0);
	});

	it('returns warming for an empty bucket and requests refill', async () => {
		const requestRefill = vi.fn(async () => {});
		const bank = new QuestionBank({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			findRandom: async () => null,
			serveCached: async (doc) => ({ cached: true, questionId: doc.questionId }),
			requestRefill
		});

		const outcome = await bank.get('AP Biology', 'Unit 1');
		expect(outcome).toEqual({
			status: 'warming',
			retryAfterSeconds: QUESTION_POOL_CONFIG.warmingRetryAfterSeconds
		});
		expect(requestRefill).toHaveBeenCalledWith('AP Biology', 'Unit 1');
	});

	it('resets exclusions when the bucket still has active rows', async () => {
		const docs: FakeDoc[] = [{ questionId: 'keep', randomKey: 0.5 }];
		countActivePoolRows.mockResolvedValue(1);
		const bank = new QuestionBank({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			findRandom: createFindRandom(docs),
			serveCached: async (doc) => ({ cached: true, questionId: doc.questionId })
		});

		const outcome = await bank.get('AP Biology', 'Unit 1', {
			excludeQuestionIds: ['keep']
		});
		expect(outcome.status).toBe('found');
		if (outcome.status === 'found') {
			expect(outcome.exclusionsReset).toBe(true);
			expect(outcome.result.questionId).toBe('keep');
		}
	});

	it('returns failed when the pool query is unavailable', async () => {
		const bank = new QuestionBank({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			findRandom: async () => {
				throw new Error('db down');
			},
			serveCached: async () => ({ cached: true, questionId: '' })
		});

		const outcome = await bank.get('AP Biology', 'Unit 1');
		expect(outcome.status).toBe('failed');
	});

	it('records Neon client initialization separately from pool query time', async () => {
		const metrics = {
			questionType: 'mcq' as const,
			dbConnectMs: 0,
			poolQueryMs: 0
		};
		const bank = new QuestionBank({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			findRandom: async (input) => {
				input.onDatabaseInit?.(7);
				return { questionId: 'hit' };
			},
			serveCached: async (doc) => ({ cached: true, questionId: doc.questionId })
		});

		const outcome = await bank.get('AP Biology', 'Unit 1', { metrics });

		expect(outcome.status).toBe('found');
		expect(metrics.dbConnectMs).toBe(7);
		expect(metrics.poolQueryMs).toBeGreaterThanOrEqual(0);
	});
});
