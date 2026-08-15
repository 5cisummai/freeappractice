import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FrqGrade } from '$lib/question-bank/frq/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqAttemptCriterionGrades, frqAttemptGrades, frqAttempts } from '$lib/server/neon/schema';

export interface IFrqAttempt {
	id: string;
	userId: string;
	submissionId: string;
	questionId: string;
	apClass: string;
	unit: string;
	formatId: string;
	responses: Record<string, string>;
	status: 'grading' | 'graded';
	grade?: FrqGrade;
	timeTakenMs: number;
	profileVersion: string;
	rubricVersion: string;
	promptVersion: string;
	gradingModel?: string;
	createdAt: Date;
	updatedAt: Date;
}

async function hydrateAttempts(rows: IFrqAttempt[]): Promise<IFrqAttempt[]> {
	if (!rows.length) return [];

	const db = getNeonDatabase();
	const attemptIds = [...new Set(rows.map((row) => row.id))];
	const [gradeRows, criterionRows] = await Promise.all([
		db.select().from(frqAttemptGrades).where(inArray(frqAttemptGrades.attemptId, attemptIds)),
		db
			.select()
			.from(frqAttemptCriterionGrades)
			.where(inArray(frqAttemptCriterionGrades.attemptId, attemptIds))
	]);
	const gradesByAttempt = new Map(
		(gradeRows as Array<Record<string, any>>).map((grade) => [grade.attemptId, grade])
	);
	const criteriaByAttempt = new Map<string, Array<Record<string, any>>>();
	for (const criterion of criterionRows as Array<Record<string, any>>) {
		const list = criteriaByAttempt.get(criterion.attemptId) ?? [];
		list.push(criterion);
		criteriaByAttempt.set(criterion.attemptId, list);
	}

	return rows.map((row) => {
		const grade = gradesByAttempt.get(row.id);
		return {
			...row,
			grade: grade
				? {
						criteria: (criteriaByAttempt.get(row.id) ?? []).map((item) => ({
							criterionId: item.criterionId,
							sectionId: item.sectionId,
							label: item.label,
							points: item.points,
							pointsAvailable: item.pointsAvailable,
							evidence: item.evidence,
							feedback: item.feedback
						})),
						pointsEarned: grade.pointsEarned,
						pointsAvailable: grade.pointsAvailable,
						percentage: grade.percentage,
						overallFeedback: grade.overallFeedback
					}
				: undefined
		};
	});
}

export async function createFrqAttempt(
	input: Omit<IFrqAttempt, 'id' | 'createdAt' | 'updatedAt' | 'grade'>
): Promise<IFrqAttempt> {
	const rows = await getNeonDatabase()
		.insert(frqAttempts)
		.values({ id: randomUUID(), ...input })
		.returning();
	if (!rows[0]) throw new Error('FRQ attempt insert returned no row');
	return (await hydrateAttempts([rows[0] as IFrqAttempt]))[0];
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
	return rows[0] ? (await hydrateAttempts([rows[0] as IFrqAttempt]))[0] : null;
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
	return rows[0] ? (await hydrateAttempts([rows[0] as IFrqAttempt]))[0] : null;
}

export async function findRecentGradedFrqAttempts(
	userId: string,
	limit: number
): Promise<IFrqAttempt[]> {
	const rows = await getNeonDatabase()
		.select()
		.from(frqAttempts)
		.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.status, 'graded')))
		.orderBy(desc(frqAttempts.createdAt))
		.limit(limit);
	return hydrateAttempts(rows as IFrqAttempt[]);
}

export async function updateFrqAttemptGrade(
	attempt: IFrqAttempt,
	grade: FrqGrade,
	gradingModel: string
): Promise<void> {
	const db = getNeonDatabase();
	const writes: any[] = [
		db
			.update(frqAttempts)
			.set({ status: 'graded', gradingModel, updatedAt: new Date() })
			.where(eq(frqAttempts.id, attempt.id)),
		db.delete(frqAttemptGrades).where(eq(frqAttemptGrades.attemptId, attempt.id)),
		db.delete(frqAttemptCriterionGrades).where(eq(frqAttemptCriterionGrades.attemptId, attempt.id)),
		db.insert(frqAttemptGrades).values({
			attemptId: attempt.id,
			pointsEarned: grade.pointsEarned,
			pointsAvailable: grade.pointsAvailable,
			percentage: grade.percentage,
			overallFeedback: grade.overallFeedback
		})
	];
	if (grade.criteria.length)
		writes.push(
			db
				.insert(frqAttemptCriterionGrades)
				.values(grade.criteria.map((item) => ({ attemptId: attempt.id, ...item })))
		);
	await db.batch(writes as [any, ...any[]]);
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
