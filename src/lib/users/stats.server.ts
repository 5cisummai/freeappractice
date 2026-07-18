import { sanitizeAttemptTimeMs } from '$lib/users/attempt-time';
import type { IUserProfile } from '$lib/users/model.server';
import type { StatsData } from '$lib/users/types';
import type { FrqActivity } from '$lib/frq/attempts.server';

function toLocalDayKey(date: Date, timeZone = 'UTC'): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
	const date = new Date(`${dayKey}T12:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + deltaDays);
	return date.toISOString().slice(0, 10);
}

/** Current daily streak using the user's local calendar days when a timezone is provided. */
export function calcStreak(history: Array<{ attemptedAt: Date }>, timeZone?: string): number {
	if (!history.length) return 0;

	const zone = timeZone || 'UTC';
	const sortedDates = [
		...new Set(history.map((q) => toLocalDayKey(new Date(q.attemptedAt), zone)))
	].sort((a, b) => b.localeCompare(a));

	const today = toLocalDayKey(new Date(), zone);
	const yesterday = shiftDayKey(today, -1);

	if (!sortedDates.includes(today) && !sortedDates.includes(yesterday)) return 0;

	let streak = 1;
	for (let i = 1; i < sortedDates.length; i++) {
		if (shiftDayKey(sortedDates[i - 1], -1) === sortedDates[i]) streak++;
		else break;
	}
	return streak;
}

export function buildStatsData(
	user: IUserProfile,
	timeZone?: string,
	frqActivity: FrqActivity[] = []
): StatsData {
	const history = user.questionHistory ?? [];
	const answeredHistory = history.filter((q) => q.wasCorrect !== undefined);
	const totalQuestions = answeredHistory.length;
	const correctAnswers = answeredHistory.filter((q) => q.wasCorrect).length;
	const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
	const totalTimeMs =
		history.reduce((sum, q) => sum + sanitizeAttemptTimeMs(q.timeTakenMs), 0) +
		frqActivity.reduce((sum, attempt) => sum + sanitizeAttemptTimeMs(attempt.timeTakenMs), 0);
	const totalTimeHours = Math.round((totalTimeMs / 1000 / 60 / 60) * 10) / 10;
	const currentStreak = calcStreak([...history, ...frqActivity], timeZone);
	const frqAveragePercentage = frqActivity.length
		? Math.round(
				frqActivity.reduce((sum, attempt) => sum + attempt.percentage, 0) / frqActivity.length
			)
		: 0;

	const subjectStats: Record<string, { total: number; correct: number; totalTime: number }> = {};
	answeredHistory.forEach((q) => {
		if (!subjectStats[q.apClass]) subjectStats[q.apClass] = { total: 0, correct: 0, totalTime: 0 };
		subjectStats[q.apClass].total++;
		if (q.wasCorrect) subjectStats[q.apClass].correct++;
		subjectStats[q.apClass].totalTime += sanitizeAttemptTimeMs(q.timeTakenMs);
	});
	const frqBySubject = new Map<string, { attempts: number; totalPercentage: number }>();
	for (const attempt of frqActivity) {
		const current = frqBySubject.get(attempt.apClass) ?? { attempts: 0, totalPercentage: 0 };
		current.attempts++;
		current.totalPercentage += attempt.percentage;
		frqBySubject.set(attempt.apClass, current);
	}
	const subjectNames = new Set([...Object.keys(subjectStats), ...frqBySubject.keys()]);
	const subjectBreakdown = [...subjectNames]
		.map((subject) => {
			const mcq = subjectStats[subject] ?? { total: 0, correct: 0, totalTime: 0 };
			const frq = frqBySubject.get(subject) ?? { attempts: 0, totalPercentage: 0 };
			return {
				subject,
				total: mcq.total,
				correct: mcq.correct,
				accuracy: mcq.total ? Math.round((mcq.correct / mcq.total) * 100) : 0,
				avgTimeSeconds: mcq.total ? Math.round(mcq.totalTime / mcq.total / 1000) : 0,
				frqAttempts: frq.attempts,
				frqAveragePercentage: frq.attempts ? Math.round(frq.totalPercentage / frq.attempts) : 0
			};
		})
		.sort((a, b) => b.total + b.frqAttempts - (a.total + a.frqAttempts));

	const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
	const recentHistory = answeredHistory.filter((q) => new Date(q.attemptedAt) >= sevenDaysAgo);
	const recentCorrect = recentHistory.filter((q) => q.wasCorrect).length;
	const recentAccuracy =
		recentHistory.length > 0 ? Math.round((recentCorrect / recentHistory.length) * 100) : 0;
	const recentFrq = frqActivity.filter((attempt) => attempt.attemptedAt >= sevenDaysAgo);

	return {
		overview: {
			totalQuestions,
			correctAnswers,
			accuracy,
			currentStreak,
			totalTimeHours,
			frqSubmissions: frqActivity.length,
			frqAveragePercentage,
			memberSince: user.createdAt.toISOString()
		},
		recentPerformance: {
			questionsLast7Days: recentHistory.length,
			accuracyLast7Days: recentAccuracy,
			frqSubmissionsLast7Days: recentFrq.length
		},
		subjectBreakdown
	};
}
