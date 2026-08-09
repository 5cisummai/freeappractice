import { and, asc, eq } from 'drizzle-orm';
import { frqAttemptGrades, frqAttempts, mcqAttempts } from '$lib/server/neon/schema';
import type { InsightScoredAttempt } from '$lib/super/insights.server';

function validDate(value: Date | null | undefined): Date | null {
	return value && Number.isFinite(value.getTime()) ? value : null;
}

/**
 * Read only the scored fields needed by Insights. Question responses, FRQ text,
 * and the rest of the user profile never cross this boundary.
 */
export async function getScoredAttemptsForUser(userId: string): Promise<InsightScoredAttempt[]> {
	const { getNeonDatabase } = await import('$lib/server/neon/db');
	const db = getNeonDatabase();
	const [mcqRows, frqRows] = await Promise.all([
		db
			.select({
				id: mcqAttempts.id,
				questionId: mcqAttempts.questionId,
				apClass: mcqAttempts.apClass,
				unit: mcqAttempts.unit,
				wasCorrect: mcqAttempts.wasCorrect,
				attemptedAt: mcqAttempts.attemptedAt
			})
			.from(mcqAttempts)
			.where(eq(mcqAttempts.userId, userId))
			.orderBy(asc(mcqAttempts.attemptedAt), asc(mcqAttempts.id)),
		db
			.select({
				id: frqAttempts.id,
				apClass: frqAttempts.apClass,
				unit: frqAttempts.unit,
				percentage: frqAttemptGrades.percentage,
				pointsEarned: frqAttemptGrades.pointsEarned,
				pointsAvailable: frqAttemptGrades.pointsAvailable,
				attemptedAt: frqAttempts.createdAt
			})
			.from(frqAttempts)
			.innerJoin(frqAttemptGrades, eq(frqAttemptGrades.attemptId, frqAttempts.id))
			.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.status, 'graded')))
			.orderBy(asc(frqAttempts.createdAt), asc(frqAttempts.id))
	]);

	const mcq = mcqRows.flatMap<InsightScoredAttempt>((attempt) => {
		const attemptedAt = validDate(attempt.attemptedAt);
		return typeof attempt.wasCorrect !== 'boolean' || !attemptedAt
			? []
			: [
					{
						id: `mcq:${attempt.questionId}:${attempt.id}`,
						source: 'mcq',
						apClass: attempt.apClass,
						unit: attempt.unit,
						scorePercentage: attempt.wasCorrect ? 100 : 0,
						attemptedAt
					}
				];
	});

	const frq = frqRows.flatMap<InsightScoredAttempt>((attempt) => {
		const attemptedAt = validDate(attempt.attemptedAt);
		return !attemptedAt || !Number.isFinite(attempt.percentage)
			? []
			: [
					{
						id: `frq:${attempt.id}`,
						source: 'frq',
						apClass: attempt.apClass,
						unit: attempt.unit,
						scorePercentage: attempt.percentage,
						rubricPointsEarned: attempt.pointsEarned,
						rubricPointsAvailable: attempt.pointsAvailable,
						attemptedAt
					}
				];
	});

	return [...mcq, ...frq].sort(
		(a, b) =>
			new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime() ||
			(a.id ?? '').localeCompare(b.id ?? '')
	);
}
