import { findRecentGradedFrqAttempts } from '$lib/grading/frq/storage.server';
import { getCurrentStoredInsightReport, type InsightUnit } from '$lib/super/insights.server';
import { getRecentSuperMistakes } from '$lib/super/context.server';
import { getUserDashboardProfile, getUserProgress } from '$lib/users/model.server';
import { getDashboardStats } from '$lib/users/dashboard-queries.server';

function summarizeInsightUnit(unit: InsightUnit) {
	return {
		totalScoredAttempts: unit.totalScoredAttempts,
		metrics: unit.metrics,
		strengths: unit.strengths.slice(0, 3),
		weaknesses: unit.weaknesses.slice(0, 3),
		actionableInsights: unit.actionableInsights.slice(0, 5)
	};
}

export async function getCoachActivitySummary(userId: string) {
	const profile = await getUserDashboardProfile(userId);
	const memberSince = profile?.createdAt ?? new Date();
	const stats = await getDashboardStats(userId, memberSince, 'UTC', true);

	return {
		currentStreak: stats.overview.currentStreak,
		totalTimeHours: stats.overview.totalTimeHours,
		lifetime: {
			mcqAttempts: stats.overview.totalQuestions,
			mcqAccuracy: stats.overview.accuracy,
			frqSubmissions: stats.overview.frqSubmissions,
			frqAveragePercentage: stats.overview.frqAveragePercentage
		},
		last7Days: {
			mcqAttempts: stats.recentPerformance.questionsLast7Days,
			mcqAccuracy: stats.recentPerformance.accuracyLast7Days,
			frqSubmissions: stats.recentPerformance.frqSubmissionsLast7Days
		},
		subjectBreakdown: stats.subjectBreakdown.slice(0, 8)
	};
}

export async function getCoachUnitDetail(userId: string, apClass: string, unit: string) {
	const [progressRows, recentMistakes, insightReport] = await Promise.all([
		getUserProgress(userId),
		getRecentSuperMistakes(userId, { apClass, unit }),
		getCurrentStoredInsightReport(userId)
	]);

	const progress = progressRows.find((row) => row.apClass === apClass && row.unit === unit);
	const course = insightReport?.report.courses.find((item) => item.apClass === apClass);
	const unitInsights = course?.units.find((item) => item.unit === unit);

	return {
		apClass,
		unit,
		progress: progress
			? {
					mastery: progress.mastery,
					totalAttempts: progress.totalAttempts,
					correctAttempts: progress.correctAttempts,
					lastAttemptAt: progress.lastAttemptAt?.toISOString() ?? null,
					lastReviewedAt: progress.lastReviewedAt?.toISOString() ?? null
				}
			: null,
		recentMistakes: recentMistakes.slice(0, 5),
		insights: unitInsights ? summarizeInsightUnit(unitInsights) : null,
		insightsGeneratedAt: insightReport?.generatedAt ?? null
	};
}

export async function getCoachFrqPerformance(
	userId: string,
	filter: { apClass?: string; unit?: string; limit?: number } = {}
) {
	const limit = Math.min(Math.max(filter.limit ?? 5, 1), 6);
	const attempts = await findRecentGradedFrqAttempts(userId, {
		limit,
		apClass: filter.apClass,
		unit: filter.unit
	});

	return attempts.map((attempt) => ({
		attemptId: attempt.id,
		questionId: attempt.questionId,
		apClass: attempt.apClass,
		unit: attempt.unit,
		attemptedAt: attempt.createdAt.toISOString(),
		pointsEarned: attempt.grade?.pointsEarned ?? 0,
		pointsAvailable: attempt.grade?.pointsAvailable ?? 0,
		percentage: attempt.grade?.percentage ?? 0,
		overallFeedback: attempt.grade?.overallFeedback ?? '',
		criteria: (attempt.grade?.criteria ?? []).map((criterion) => ({
			label: criterion.label,
			points: criterion.points,
			pointsAvailable: criterion.pointsAvailable,
			feedback: criterion.feedback
		}))
	}));
}
