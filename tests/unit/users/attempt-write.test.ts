import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	execute: vi.fn(),
	select: vi.fn(),
	from: vi.fn(),
	where: vi.fn(),
	limit: vi.fn()
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		execute: mocks.execute,
		select: mocks.select
	})
}));

import { persistQuestionAttempt } from '#lib/users/attempt-write.server.js';

const attempt = {
	questionId: 'question-1',
	course: 'AP Biology',
	unit: 'Unit 1',
	selectedAnswer: 'B' as const,
	wasCorrect: true,
	timeTakenMs: 1200,
	attemptedAt: new Date('2026-08-09T20:00:00.000Z')
};

describe('persistQuestionAttempt', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ limit: mocks.limit });
		mocks.limit.mockResolvedValue([]);
	});

	it('returns the atomic insert and progress result', async () => {
		mocks.execute.mockResolvedValue({
			rows: [
				{
					mastery: 75,
					totalAttempts: 4,
					correctAttempts: 3,
					newlyRecorded: true
				}
			]
		});

		await expect(
			persistQuestionAttempt('student-1', attempt, '019fe8b0-0000-7000-8000-000000000001')
		).resolves.toEqual({
			mastery: 75,
			totalAttempts: 4,
			correctAttempts: 3,
			newlyRecorded: true
		});
		expect(mocks.execute).toHaveBeenCalledOnce();
	});

	it('returns existing progress without incrementing on an idempotent retry', async () => {
		mocks.execute.mockResolvedValue({
			rows: [
				{
					mastery: '75',
					totalAttempts: '4',
					correctAttempts: '3',
					newlyRecorded: false
				}
			]
		});

		await expect(
			persistQuestionAttempt('student-1', attempt, '019fe8b0-0000-7000-8000-000000000001')
		).resolves.toMatchObject({
			totalAttempts: 4,
			newlyRecorded: false
		});
	});

	it('fails clearly if the progress statement returns no row', async () => {
		mocks.execute.mockResolvedValue({ rows: [] });

		await expect(persistQuestionAttempt('student-1', attempt)).rejects.toThrow(
			'Progress update returned no row'
		);
	});
});
