import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	delete: vi.fn(),
	where: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ batch: mocks.batch, delete: mocks.delete })
}));

import { clearPracticeDataForUser } from '$lib/users/clear-practice-data.server';

describe('clearPracticeDataForUser', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.delete.mockImplementation(() => ({ where: mocks.where }));
		mocks.where
			.mockReturnValueOnce({ kind: 'progress' })
			.mockReturnValueOnce({ kind: 'mcq-attempts' })
			.mockReturnValueOnce({ kind: 'quiz-attempts' })
			.mockReturnValueOnce({ kind: 'bookmarks' })
			.mockReturnValueOnce({ kind: 'frq-attempts' });
		mocks.batch.mockResolvedValue([]);
	});

	it('clears every practice table in one database batch', async () => {
		await clearPracticeDataForUser('student-1');

		expect(mocks.batch).toHaveBeenCalledWith([
			{ kind: 'progress' },
			{ kind: 'mcq-attempts' },
			{ kind: 'quiz-attempts' },
			{ kind: 'bookmarks' },
			{ kind: 'frq-attempts' }
		]);
	});
});
