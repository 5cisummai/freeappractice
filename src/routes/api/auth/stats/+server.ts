import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { calcStreak, findUserOrFail } from '$lib/server/utils';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserOrFail(userId, 'questionHistory createdAt');

		const history = user.questionHistory ?? [];
		const totalQuestions = history.length;
		const correctAnswers = history.filter((q) => q.wasCorrect).length;
		const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
		const totalTimeMs = history.reduce((sum, q) => sum + (q.timeTakenMs ?? 0), 0);
		const totalTimeHours = Math.round((totalTimeMs / 1000 / 60 / 60) * 10) / 10;
		const currentStreak = calcStreak(history);

		const subjectStats: Record<string, { total: number; correct: number; totalTime: number }> = {};
		history.forEach((q) => {
			if (!subjectStats[q.apClass])
				subjectStats[q.apClass] = { total: 0, correct: 0, totalTime: 0 };
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

		const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
		const dailyActivity: Record<string, { total: number; correct: number }> = {};
		history.forEach((q) => {
			const d = new Date(q.attemptedAt);
			if (d >= thirtyDaysAgo) {
				const key = d.toISOString().split('T')[0];
				if (!dailyActivity[key]) dailyActivity[key] = { total: 0, correct: 0 };
				dailyActivity[key].total++;
				if (q.wasCorrect) dailyActivity[key].correct++;
			}
		});

		return json({
			overview: {
				totalQuestions,
				correctAnswers,
				accuracy,
				currentStreak,
				totalTimeHours,
				memberSince: user.createdAt
			},
			recentPerformance: {
				questionsLast7Days: recentHistory.length,
				accuracyLast7Days: recentAccuracy
			},
			subjectBreakdown,
			dailyActivity
		});
	},
	{ logLabel: 'Stats error', errorMessage: 'Failed to fetch statistics' }
);
