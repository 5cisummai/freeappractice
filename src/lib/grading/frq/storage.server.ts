import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { FrqGrade } from '$lib/question-bank/frq/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqAttempts } from '$lib/server/neon/schema';

export interface IFrqAttempt {
	id: string;
	userId: string;
	submissionId: string;
	questionId: string;
	course: string;
	unit: string;
	formatId: string;
	responses: Record<string, string>;
	status: 'grading' | 'graded';
	grade?: FrqGrade;
	timeTakenMs: number;
	pointsEarned: number | null;
	pointsAvailable: number | null;
	percentage: number | null;
	gradingModel?: string;
	createdAt: Date;
	updatedAt: Date;
}

function toAttempt(row: typeof frqAttempts.$inferSelect): IFrqAttempt {
	return {
		id: row.id,
		userId: row.userId,
		submissionId: row.submissionId,
		questionId: row.questionId,
		course: row.course,
		unit: row.unit,
		formatId: row.formatId,
		responses: row.responses,
		status: row.status === 'graded' ? 'graded' : 'grading',
		grade: row.grade ?? undefined,
		timeTakenMs: row.timeTakenMs,
		pointsEarned: row.pointsEarned,
		pointsAvailable: row.pointsAvailable,
		percentage: row.percentage,
		gradingModel: row.gradingModel ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export async function createFrqAttempt(
	input: Omit<
		IFrqAttempt,
		'id' | 'createdAt' | 'updatedAt' | 'grade' | 'pointsEarned' | 'pointsAvailable' | 'percentage'
	>
): Promise<IFrqAttempt> {
	const rows = await getNeonDatabase()
		.insert(frqAttempts)
		.values({ id: randomUUID(), ...input })
		.returning();
	if (!rows[0]) throw new Error('FRQ attempt insert returned no row');
	return toAttempt(rows[0]);
}

export async function findFrqAttemptBySubmission(
	userId: string,
	submissionId: string
): Promise<IFrqAttempt | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqAttempts)
		.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.submissionId, submissionId)))
		.limit(1);
	return rows[0] ? toAttempt(rows[0]) : null;
}

export async function findGradedFrqAttempt(
	userId: string,
	attemptId: string
): Promise<IFrqAttempt | null> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqAttempts)
		.where(
			and(
				eq(frqAttempts.id, attemptId),
				eq(frqAttempts.userId, userId),
				eq(frqAttempts.status, 'graded')
			)
		)
		.limit(1);
	return rows[0] ? toAttempt(rows[0]) : null;
}

export type RecentGradedFrqAttemptQuery = {
	limit?: number;
	course?: string;
	unit?: string;
};

export async function findRecentGradedFrqAttempts(
	userId: string,
	options: number | RecentGradedFrqAttemptQuery = 8
): Promise<IFrqAttempt[]> {
	const normalized = typeof options === 'number' ? { limit: options } : options;
	const limit = Math.min(Math.max(normalized.limit ?? 8, 1), 20);
	const rows = await getNeonDatabase()
		.select()
		.from(frqAttempts)
		.where(
			and(
				eq(frqAttempts.userId, userId),
				eq(frqAttempts.status, 'graded'),
				normalized.course ? eq(frqAttempts.course, normalized.course) : undefined,
				normalized.unit ? eq(frqAttempts.unit, normalized.unit) : undefined
			)
		)
		.orderBy(desc(frqAttempts.createdAt))
		.limit(limit);
	return rows.map(toAttempt);
}

export async function updateFrqAttemptGrade(
	attempt: IFrqAttempt,
	grade: FrqGrade,
	gradingModel: string
): Promise<void> {
	await getNeonDatabase()
		.update(frqAttempts)
		.set({
			status: 'graded',
			gradingModel,
			pointsEarned: grade.pointsEarned,
			pointsAvailable: grade.pointsAvailable,
			percentage: grade.percentage,
			grade,
			updatedAt: new Date()
		})
		.where(eq(frqAttempts.id, attempt.id));
}

export async function deleteFrqAttemptIfGrading(attemptId: string): Promise<number> {
	const rows = await getNeonDatabase()
		.delete(frqAttempts)
		.where(and(eq(frqAttempts.id, attemptId), eq(frqAttempts.status, 'grading')))
		.returning({ id: frqAttempts.id });
	return rows.length;
}

export async function deleteFrqAttemptsForUser(userId: string): Promise<number> {
	const rows = await getNeonDatabase()
		.delete(frqAttempts)
		.where(eq(frqAttempts.userId, userId))
		.returning({ id: frqAttempts.id });
	return rows.length;
}
