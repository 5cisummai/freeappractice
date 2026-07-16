import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStatsData, calcStreak } from '$lib/users/stats.server';
import type { IQuestionAttempt } from '$lib/users/records.server';
import type { IUserProfile } from '$lib/users/model.server';

function attempt(
	overrides: Partial<IQuestionAttempt> & Pick<IQuestionAttempt, 'attemptedAt'>
): IQuestionAttempt {
	return {
		questionId: 'q1',
		apClass: 'AP Biology',
		unit: 'Unit 1',
		selectedAnswer: 'A',
		wasCorrect: true,
		timeTakenMs: 5_000,
		...overrides
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe('calcStreak', () => {
	it('returns 0 for empty history or gaps before yesterday', () => {
		expect(calcStreak([])).toBe(0);
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-15T18:00:00.000Z'));
		expect(calcStreak([attempt({ attemptedAt: new Date('2026-07-10T12:00:00.000Z') })])).toBe(
			0
		);
	});

	it('counts consecutive local calendar days including yesterday', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-15T18:00:00.000Z'));

		const history = [
			attempt({ attemptedAt: new Date('2026-07-15T01:00:00.000Z') }),
			attempt({ attemptedAt: new Date('2026-07-14T20:00:00.000Z') }),
			attempt({ attemptedAt: new Date('2026-07-13T20:00:00.000Z') })
		];

		expect(calcStreak(history, 'UTC')).toBe(3);
	});

	it('uses timezone day boundaries', () => {
		vi.useFakeTimers();
		// 2026-07-15 07:00 UTC is still 2026-07-14 in America/Los_Angeles
		vi.setSystemTime(new Date('2026-07-15T07:00:00.000Z'));

		const history = [attempt({ attemptedAt: new Date('2026-07-15T06:30:00.000Z') })];
		expect(calcStreak(history, 'America/Los_Angeles')).toBe(1);
		expect(calcStreak(history, 'UTC')).toBe(1);
	});
});

describe('buildStatsData', () => {
	it('aggregates accuracy, time, streak, and subject breakdown', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

		const user = {
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			questionHistory: [
				attempt({
					apClass: 'AP Biology',
					wasCorrect: true,
					timeTakenMs: 10_000,
					attemptedAt: new Date('2026-07-15T10:00:00.000Z')
				}),
				attempt({
					questionId: 'q2',
					apClass: 'AP Chemistry',
					wasCorrect: false,
					timeTakenMs: 20_000,
					attemptedAt: new Date('2026-07-14T10:00:00.000Z')
				}),
				attempt({
					questionId: 'q3',
					apClass: 'AP Biology',
					wasCorrect: true,
					timeTakenMs: 30_000,
					attemptedAt: new Date('2026-06-01T10:00:00.000Z')
				})
			]
		} as IUserProfile;

		const stats = buildStatsData(user, 'UTC');
		expect(stats.overview.totalQuestions).toBe(3);
		expect(stats.overview.correctAnswers).toBe(2);
		expect(stats.overview.accuracy).toBe(67);
		expect(stats.overview.currentStreak).toBe(2);
		expect(stats.recentPerformance.questionsLast7Days).toBe(2);
		expect(stats.subjectBreakdown[0]?.subject).toBe('AP Biology');
		expect(stats.subjectBreakdown).toHaveLength(2);
	});
});
