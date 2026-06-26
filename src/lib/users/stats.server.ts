import type { IUserProfile } from '$lib/users/model.server';
import type { StatsData } from '$lib/users/types';

/** Calculate current daily streak from a list of attempts with `attemptedAt` dates. */
export function calcStreak(history: Array<{ attemptedAt: Date }>): number {
	if (!history.length) return 0;

	const toUtcDayKey = (date: Date) => date.toISOString().slice(0, 10);

	const sortedDates = [...new Set(history.map((q) => toUtcDayKey(new Date(q.attemptedAt))))].sort(
		(a, b) => b.localeCompare(a)
	);

	const today = toUtcDayKey(new Date());
	const yesterday = toUtcDayKey(new Date(Date.now() - 86_400_000));

	if (!sortedDates.includes(today) && !sortedDates.includes(yesterday)) return 0;

	let streak = 1;
	for (let i = 1; i < sortedDates.length; i++) {
		const previous = new Date(`${sortedDates[i - 1]}T00:00:00.000Z`);
		const current = new Date(`${sortedDates[i]}T00:00:00.000Z`);
		const dayDiff = Math.round((previous.getTime() - current.getTime()) / 86_400_000);
		if (dayDiff === 1) streak++;
		else break;
	}
	return streak;
}

export function buildStatsData(user: IUserProfile): StatsData {
	const history = user.questionHistory ?? [];
	const totalQuestions = history.length;
	const correctAnswers = history.filter((q) => q.wasCorrect).length;
	const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
	const totalTimeMs = history.reduce((sum, q) => sum + (q.timeTakenMs ?? 0), 0);
	const totalTimeHours = Math.round((totalTimeMs / 1000 / 60 / 60) * 10) / 10;
	const currentStreak = calcStreak(history);

	const subjectStats: Record<string, { total: number; correct: number; totalTime: number }> = {};
	history.forEach((q) => {
		if (!subjectStats[q.apClass]) subjectStats[q.apClass] = { total: 0, correct: 0, totalTime: 0 };
		subjectStats[q.apClass].total++;
		if (q.wasCorrect) subjectStats[q.apClass].correct++;
		subjectStats[q.apClass].totalTime += q.timeTakenMs ?? 0;
	});
	const subjectBreakdown = Object.entries(subjectStats)
		.map(([subject, s]) => ({
			subject,
			total: s.total,
			correct: s.correct,
			accuracy: Math.round((s.correct / s.total) * 100),
			avgTimeSeconds: Math.round(s.totalTime / s.total / 1000)
		}))
		.sort((a, b) => b.total - a.total);

	const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
	const recentHistory = history.filter((q) => new Date(q.attemptedAt) >= sevenDaysAgo);
	const recentCorrect = recentHistory.filter((q) => q.wasCorrect).length;
	const recentAccuracy =
		recentHistory.length > 0 ? Math.round((recentCorrect / recentHistory.length) * 100) : 0;

	return {
		overview: {
			totalQuestions,
			correctAnswers,
			accuracy,
			currentStreak,
			totalTimeHours,
			memberSince: user.createdAt.toISOString()
		},
		recentPerformance: {
			questionsLast7Days: recentHistory.length,
			accuracyLast7Days: recentAccuracy
		},
		subjectBreakdown
	};
}
