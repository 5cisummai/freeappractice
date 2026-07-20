import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectDb } = vi.hoisted(() => ({
	connectDb: vi.fn(async () => ({}))
}));

vi.mock('$lib/server/db', () => ({ connectDb }));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { createQuestionPool, selectRandomActiveDoc } from '$lib/questions/pool.server';
import { QUESTION_POOL_CONFIG } from '$lib/questions/pool-constants';

type FakeDoc = { _id: { toString(): string }; s3QuestionId: string; randomKey: number };

function createFakeModel(docs: FakeDoc[]) {
	return {
		findOne(
			filter: Record<string, unknown>,
			_projection?: Record<string, 0 | 1> | null,
			options?: { sort?: Record<string, 1 | -1> }
		) {
			const randomKey = filter.randomKey as { $gte?: number; $lt?: number } | undefined;
			const excluded = (filter.s3QuestionId as { $nin?: string[] } | undefined)?.$nin ?? [];

			let matched = docs.filter((doc) => {
				if (excluded.includes(doc.s3QuestionId)) return false;
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
		{ _id: { toString: () => '1' }, s3QuestionId: 'a', randomKey: 0.1 },
		{ _id: { toString: () => '2' }, s3QuestionId: 'b', randomKey: 0.4 },
		{ _id: { toString: () => '3' }, s3QuestionId: 'c', randomKey: 0.8 }
	];

	it('selects the first doc with randomKey >= pivot', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: [],
			projection: { s3QuestionId: 1, randomKey: 1 },
			pivot: 0.35
		});
		expect(hit?.s3QuestionId).toBe('b');
	});

	it('wraps around when no doc has randomKey >= pivot', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: [],
			projection: { s3QuestionId: 1, randomKey: 1 },
			pivot: 0.95
		});
		expect(hit?.s3QuestionId).toBe('a');
	});

	it('honors exclusion list on both pivot passes', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: ['a', 'b'],
			projection: { s3QuestionId: 1, randomKey: 1 },
			pivot: 0.95
		});
		expect(hit?.s3QuestionId).toBe('c');
	});

	it('returns null when every active id is excluded', async () => {
		const hit = await selectRandomActiveDoc({
			model: createFakeModel(docs),
			apClass: 'AP Biology',
			unit: 'Unit 1',
			excludeQuestionIds: ['a', 'b', 'c'],
			projection: { s3QuestionId: 1, randomKey: 1 },
			pivot: 0.2
		});
		expect(hit).toBeNull();
	});
});

describe('createQuestionPool selection boundary', () => {
	beforeEach(() => {
		connectDb.mockReset();
		connectDb.mockResolvedValue({});
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
			projection: { s3QuestionId: 1 },
			serveCached: async (doc) => ({ cached: true, questionId: doc.s3QuestionId }),
			requestRefill
		});

		const outcome = await pool.getQuestion('AP Biology', 'Unit 1');
		expect(outcome).toEqual({
			status: 'warming',
			retryAfterSeconds: QUESTION_POOL_CONFIG.warmingRetryAfterSeconds
		});
		expect(requestRefill).toHaveBeenCalledWith('AP Biology', 'Unit 1');
		expect(connectDb).toHaveBeenCalled();
	});

	it('resets exclusions when the bucket still has active rows', async () => {
		const docs: FakeDoc[] = [
			{ _id: { toString: () => '1' }, s3QuestionId: 'keep', randomKey: 0.5 }
		];
		const model = createFakeModel(docs);
		const pool = createQuestionPool({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			model,
			projection: { s3QuestionId: 1 },
			serveCached: async (doc) => ({ cached: true, questionId: doc.s3QuestionId })
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

	it('returns failed when the database is unavailable', async () => {
		connectDb.mockRejectedValueOnce(new Error('db down'));
		const pool = createQuestionPool({
			questionType: 'mcq',
			logScope: 'test',
			normalizeUnit: (u) => u ?? '',
			model: createFakeModel([]),
			projection: { s3QuestionId: 1 },
			serveCached: async (doc) => ({ cached: true, questionId: doc.s3QuestionId })
		});

		const outcome = await pool.getQuestion('AP Biology', 'Unit 1');
		expect(outcome.status).toBe('failed');
	});
});
