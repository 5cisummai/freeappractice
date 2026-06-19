import type { ProgressEntry, StatsData } from '$lib/types/user-stats';
import { calcStreak } from '$lib/server/utils';
import type { IUserProfile } from '$lib/server/models/user-profile';

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

export function buildProgressData(user: IUserProfile): ProgressEntry[] {
	return (user.progress ?? []).map((entry) => ({
		apClass: entry.apClass,
		unit: entry.unit,
		totalAttempts: entry.totalAttempts,
		correctAttempts: entry.correctAttempts,
		mastery: entry.mastery,
		lastAttemptAt: entry.lastAttemptAt?.toISOString()
	}));
}
