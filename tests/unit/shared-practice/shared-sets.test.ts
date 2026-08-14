import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	execute: vi.fn(),
	getQuestionsLookupMap: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ execute: mocks.execute })
}));

vi.mock('$lib/questions/storage.server', () => ({
	getQuestionsLookupMap: mocks.getQuestionsLookupMap
}));

import {
	createSharedQuiz,
	SharedQuizValidationError
} from '$lib/shared-practice/shared-sets.server';

const question = {
	id: 'question-1',
	apClass: 'AP Biology',
	contentHash: 'hash-1'
};

function flattenSql(query: unknown): string {
	if (query == null) return '';
	if (typeof query === 'string' || typeof query === 'number' || typeof query === 'boolean') {
		return String(query);
	}
	if (typeof query !== 'object') return '';
	const record = query as { queryChunks?: unknown[]; value?: unknown };
	if (Array.isArray(record.queryChunks)) return record.queryChunks.map(flattenSql).join('');
	if (Array.isArray(record.value)) return record.value.map(flattenSql).join('');
	if (typeof record.value === 'string') return record.value;
	return '';
}

describe('createSharedQuiz', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getQuestionsLookupMap.mockResolvedValue(new Map([[question.id, question]]));
		mocks.execute.mockResolvedValue({ rows: [{ id: 'set-1', slug: 'abcdefghij' }] });
	});

	it('rejects empty, oversized, or duplicate question lists before writing', async () => {
		await expect(createSharedQuiz({ questionIds: [] })).rejects.toBeInstanceOf(
			SharedQuizValidationError
		);
		await expect(
			createSharedQuiz({ questionIds: ['question-1', 'question-1'] })
		).rejects.toBeInstanceOf(SharedQuizValidationError);
		expect(mocks.execute).not.toHaveBeenCalled();
	});

	it('rejects questions that are no longer in the pool', async () => {
		mocks.getQuestionsLookupMap.mockResolvedValueOnce(new Map());

		await expect(createSharedQuiz({ questionIds: ['missing'] })).rejects.toThrow(
			'One or more quiz questions are no longer available.'
		);
		expect(mocks.execute).not.toHaveBeenCalled();
	});

	it('casts VALUES types so Neon HTTP does not insert text into integer/timestamptz columns', async () => {
		const created = await createSharedQuiz({
			questionIds: ['question-1'],
			unit: 'Unit 1',
			creatorUserId: 'user-1'
		});
		expect(created.title).toBe('AP Biology Unit 1 — 1 Questions');
		expect(created.slug).toMatch(/^[a-z2-9]{12}$/);
		expect(created.id).toEqual(expect.any(String));

		const sqlText = flattenSql(mocks.execute.mock.calls[0]?.[0]);
		expect(sqlText).toContain('::integer,');
		expect(sqlText).toContain('::timestamptz');
		expect(sqlText).toContain('::text,');
		expect(sqlText).toContain('INSERT INTO "app"."shared_practice_sets"');
		expect(sqlText).toContain('INSERT INTO "app"."shared_practice_set_items"');
		expect(sqlText).toContain('WHERE EXISTS (SELECT 1 FROM inserted_items)');
	});

	it('retries slug collisions and then fails clearly', async () => {
		mocks.execute.mockResolvedValue({ rows: [] });

		await expect(createSharedQuiz({ questionIds: ['question-1'] })).rejects.toThrow(
			'Could not create a share link.'
		);
		expect(mocks.execute).toHaveBeenCalledTimes(3);
	});
});
