import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ execute: mocks.execute })
}));

import { persistQuestionAttempt } from '$lib/users/attempt-write.server';

const attempt = {
	questionId: 'question-1',
	apClass: 'AP Biology',
	unit: 'Unit 1',
	selectedAnswer: 'B' as const,
	wasCorrect: true,
	timeTakenMs: 1200,
	attemptedAt: new Date('2026-08-09T20:00:00.000Z')
};

describe('persistQuestionAttempt', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the atomic insert, progress, and referral result', async () => {
		mocks.execute.mockResolvedValue({
			rows: [
				{
					mastery: 75,
					totalAttempts: 4,
					correctAttempts: 3,
					referralActivated: true,
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
			referralActivated: true,
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
					referralActivated: false,
					newlyRecorded: false
				}
			]
		});

		await expect(
			persistQuestionAttempt('student-1', attempt, '019fe8b0-0000-7000-8000-000000000001')
		).resolves.toMatchObject({
			totalAttempts: 4,
			referralActivated: false,
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
