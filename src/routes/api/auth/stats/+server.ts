import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';

function calcStreak(history: Array<{ attemptedAt: Date }>): number {
	if (!history.length) return 0;

	const sortedDates = [...new Set(history.map((q) => new Date(q.attemptedAt).toDateString()))].sort(
		(a, b) => new Date(b).getTime() - new Date(a).getTime()
	);

	const today = new Date().toDateString();
	const yesterday = new Date(Date.now() - 86400000).toDateString();

	if (!sortedDates.includes(today) && !sortedDates.includes(yesterday)) return 0;

	let streak = 1;
	for (let i = 1; i < sortedDates.length; i++) {
		const dayDiff = Math.floor(
			(new Date(sortedDates[i - 1]).getTime() - new Date(sortedDates[i]).getTime()) / 86400000
		);
		if (dayDiff === 1) streak++;
		else break;
	}
	return streak;
}

export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		await connectDb();

		const user = await User.findById(userId).select('questionHistory createdAt');
		if (!user) return json({ error: 'User not found' }, { status: 404 });

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
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Stats error:', err);
		return json({ error: 'Failed to fetch statistics' }, { status: 500 });
	}
};
