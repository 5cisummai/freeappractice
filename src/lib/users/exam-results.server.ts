import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { examAttempts } from '#lib/server/neon/schema.js';
import { assertPracticeContextAccess } from '#lib/users/practice-context.server.js';
import {
	gradeFrqAttempt,
	FrqAttemptInProgressError,
	getFrqAttemptForUser
} from '#lib/grading/frq/attempts.server.js';
import {
	findFrqAttemptBySubmission,
	deleteStaleFrqGradingClaim
} from '#lib/grading/frq/storage.server.js';
import { storedQuestionToGenerated } from '#lib/question-bank/mcq/public-payload.server.js';
import { getQuestionsLookupMap } from '#lib/question-bank/mcq/repository.server.js';
import { limitFrqGrading } from '#lib/grading/frq/rate-limit.server.js';
import {
	getFrqQuestionById,
	getFrqQuestionsLookupMap
} from '#lib/question-bank/frq/model.server.js';
import {
	frqTotalPoints,
	FrqGradeRequestSchema,
	toPublicFrqQuestion,
	type FrqGrade
} from '#lib/question-bank/frq/types.js';
function submissionId(attempt: string, item: string): string {
	const bytes = createHash('sha256')
		.update(JSON.stringify([attempt, item]))
		.digest();
	bytes[6] = (bytes[6] & 15) | 0x40;
	bytes[8] = (bytes[8] & 63) | 0x80;
	const hex = bytes.subarray(0, 16).toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseSavedResponses(value: string | undefined): Record<string, string> | null {
	try {
		const responses: unknown = JSON.parse(value ?? '{}');
		if (!responses || typeof responses !== 'object' || Array.isArray(responses)) return null;
		if (Object.values(responses).some((response) => typeof response !== 'string')) return null;
		return responses as Record<string, string>;
	} catch {
		return null;
	}
}

export async function getExamResults(userId: string, id: string) {
	const db = getNeonDatabase();
	const [attempt] = await db
		.select()
		.from(examAttempts)
		.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
		.limit(1);
	if (!attempt) return { kind: 'not_found' as const };
	await assertPracticeContextAccess(userId, { organizationId: attempt.organizationId });
	if (attempt.status !== 'submitted') return { kind: 'not_submitted' as const };
	const [questions, frqQuestions] = await Promise.all([
		getQuestionsLookupMap(
			attempt.sections
				.filter((section) => section.kind === 'mcq')
				.flatMap((section) => section.items.map((item) => item.questionId))
		),
		getFrqQuestionsLookupMap(
			attempt.sections
				.filter((section) => section.kind === 'frq')
				.flatMap((section) => section.items.map((item) => item.questionId))
		)
	]);
	const sections = attempt.sections.map((section) => {
		if (section.kind === 'mcq') {
			const items = section.items.map((item) => {
				const question = questions.get(item.questionId);
				if (!question) throw new Error('Exam question is unavailable.');
				const selected = attempt.responses[item.id] || null;
				return {
					id: item.id,
					unit: question.unit,
					selected,
					correct: selected === question.correctAnswer,
					question: storedQuestionToGenerated(question)
				};
			});
			return {
				id: section.id,
				title: section.title,
				kind: 'mcq' as const,
				correct: items.filter((item) => item.correct).length,
				total: items.length,
				items
			};
		}
		return {
			id: section.id,
			title: section.title,
			kind: 'frq' as const,
			items: section.items.map((item) => {
				const question = frqQuestions.get(item.questionId);
				return {
					id: item.id,
					question: question ? toPublicFrqQuestion(item.questionId, question) : null,
					responses: parseSavedResponses(attempt.responses[item.id]) ?? {},
					result:
						(attempt.grading[item.id] as
							| (Partial<FrqGrade> & Pick<FrqGrade, 'pointsEarned' | 'pointsAvailable'>)
							| undefined) ?? null
				};
			})
		};
	});
	return { kind: 'success' as const, value: { sections } };
}

export type ExamResults = Extract<
	Awaited<ReturnType<typeof getExamResults>>,
	{ kind: 'success' }
>['value'];

export async function gradeExamItem(userId: string, id: string, itemId: string) {
	const db = getNeonDatabase();
	const [attempt] = await db
		.select()
		.from(examAttempts)
		.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
		.limit(1);
	if (!attempt) return { kind: 'not_found' as const };
	await assertPracticeContextAccess(userId, { organizationId: attempt.organizationId });
	if (attempt.status !== 'submitted') return { kind: 'not_submitted' as const };
	const item = attempt.sections
		.filter((section) => section.kind === 'frq')
		.flatMap((section) => section.items)
		.find((item) => item.id === itemId);
	if (!item) return { kind: 'item_not_found' as const };
	if (attempt.grading[item.id])
		return { kind: 'success' as const, value: { result: attempt.grading[item.id] } };
	const responses = parseSavedResponses(attempt.responses[item.id]);
	if (!responses) return { kind: 'invalid_response' as const };
	let result: unknown;
	if (!Object.values(responses).some((value) => typeof value === 'string' && value.trim())) {
		const question = await getFrqQuestionById(item.questionId);
		result = { pointsEarned: 0, pointsAvailable: frqTotalPoints(question), percentage: 0 };
	} else {
		const request = FrqGradeRequestSchema.safeParse({
			questionId: item.questionId,
			submissionId: submissionId(id, item.id),
			responses,
			timeTakenMs: 0
		});
		if (!request.success) return { kind: 'invalid_response' as const };
		try {
			const existing = await findFrqAttemptBySubmission(
				userId,
				request.data.submissionId,
				attempt.organizationId
			);
			if (existing?.status === 'graded') {
				result = (await getFrqAttemptForUser(userId, existing.id, attempt.organizationId))?.grade;
				if (!result) throw new Error('Graded response unavailable');
			} else {
				if (existing && !(await deleteStaleFrqGradingClaim(userId, existing.id))) {
					throw new FrqAttemptInProgressError();
				}
				const rate = await limitFrqGrading(userId, item.questionId);
				if (!rate.allowed) return { kind: 'rate_limited' as const, retryAt: rate.retryAt };
				result = (
					await gradeFrqAttempt(userId, request.data, {
						organizationId: attempt.organizationId
					})
				).grade;
			}
		} catch (error) {
			if (error instanceof FrqAttemptInProgressError)
				return { kind: 'grading_in_progress' as const };
			throw error;
		}
	}
	await db
		.update(examAttempts)
		.set({
			grading: sql`jsonb_set(${examAttempts.grading}, ARRAY[${item.id}]::text[], ${JSON.stringify(result)}::jsonb, true)`
		})
		.where(
			and(
				eq(examAttempts.id, id),
				eq(examAttempts.userId, userId),
				eq(examAttempts.status, 'submitted')
			)
		);
	return { kind: 'success' as const, value: { result } };
}
