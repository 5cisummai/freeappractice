import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	delete: vi.fn(),
	where: vi.fn()
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({ batch: mocks.batch, delete: mocks.delete })
}));

import { clearPracticeDataForUser } from '#lib/users/clear-practice-data.server.js';

describe('clearPracticeDataForUser', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.delete.mockImplementation(() => ({ where: mocks.where }));
		mocks.where
			.mockReturnValueOnce({ kind: 'progress' })
			.mockReturnValueOnce({ kind: 'mcq-attempts' })
			.mockReturnValueOnce({ kind: 'quiz-attempts' })
			.mockReturnValueOnce({ kind: 'exam-attempts' })
			.mockReturnValueOnce({ kind: 'bookmarks' })
			.mockReturnValueOnce({ kind: 'frq-attempts' })
			.mockReturnValueOnce({ kind: 'practice-sessions' })
			.mockReturnValueOnce({ kind: 'practice-activity-events' })
			.mockReturnValueOnce({ kind: 'seen-questions' });
		mocks.batch.mockResolvedValue([]);
	});

	it('clears personal practice tables in one database batch', async () => {
		await clearPracticeDataForUser('student-1');

		expect(mocks.batch).toHaveBeenCalledWith([
			{ kind: 'progress' },
			{ kind: 'mcq-attempts' },
			{ kind: 'quiz-attempts' },
			{ kind: 'exam-attempts' },
			{ kind: 'bookmarks' },
			{ kind: 'frq-attempts' },
			{ kind: 'practice-sessions' },
			{ kind: 'practice-activity-events' },
			{ kind: 'seen-questions' }
		]);
	});
});
