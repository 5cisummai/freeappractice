import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { examAttempts } from '#lib/server/neon/schema.js';
import {
	gradeFrqAttempt,
	FrqAttemptInProgressError,
	getFrqAttemptForUser
} from '#lib/grading/frq/attempts.server.js';
import {
	findFrqAttemptBySubmission,
	deleteStaleFrqGradingClaim
} from '#lib/grading/frq/storage.server.js';
import { getQuestionById } from '#lib/question-bank/mcq/repository.server.js';
import {
	limitFrqGrading,
	frqGradeRateLimitedResponse
} from '#lib/grading/frq/rate-limit.server.js';
import { requireFrqPracticeEnabled } from '#lib/question-bank/frq/gate.server.js';
import { getFrqQuestionById } from '#lib/question-bank/frq/model.server.js';
import { frqTotalPoints, FrqGradeRequestSchema } from '#lib/question-bank/frq/types.js';
import { assertPracticeContextAccess } from '#lib/users/practice-context.server.js';

export const config = { maxDuration: 60 };

function submissionId(attempt: string, item: string): string {
	const bytes = createHash('sha256')
		.update(JSON.stringify([attempt, item]))
		.digest();
	bytes[6] = (bytes[6] & 15) | 0x40;
	bytes[8] = (bytes[8] & 63) | 0x80;
	const hex = bytes.subarray(0, 16).toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const GET = withAuthedHandler(
	async (event, userId) => {
		const id = event.params.id;
		if (!id) return Response.json({ error: 'Not found.' }, { status: 404 });
		const db = getNeonDatabase();
		const [attempt] = await db
			.select()
			.from(examAttempts)
			.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
			.limit(1);
		if (!attempt) return Response.json({ error: 'Not found.' }, { status: 404 });
		await assertPracticeContextAccess(userId, { organizationId: attempt.organizationId });
		if (attempt.status !== 'submitted')
			return Response.json({ error: 'Exam is not submitted.' }, { status: 409 });
		const sections = await Promise.all(
			attempt.sections.map(async (section) => {
				if (section.kind === 'mcq') {
					const questions = await Promise.all(
						section.items.map((item) => getQuestionById(item.questionId))
					);
					const correct = questions.filter(
						(question, i) => attempt.responses[section.items[i].id] === question.correctAnswer
					).length;
					return {
						id: section.id,
						title: section.title,
						kind: section.kind,
						correct,
						total: questions.length
					};
				}
				return {
					id: section.id,
					title: section.title,
					kind: section.kind,
					items: section.items.map((item) => ({
						id: item.id,
						result: attempt.grading[item.id] ?? null
					}))
				};
			})
		);
		return Response.json({ sections });
	},
	{ logLabel: 'Exam results error', errorMessage: 'Failed to load exam results' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		const id = event.params.id;
		const body = await event.request.json().catch(() => null);
		if (!id || !body || typeof body.itemId !== 'string')
			return Response.json({ error: 'Invalid item.' }, { status: 400 });
		const db = getNeonDatabase();
		const [attempt] = await db
			.select()
			.from(examAttempts)
			.where(and(eq(examAttempts.id, id), eq(examAttempts.userId, userId)))
			.limit(1);
		if (!attempt) return Response.json({ error: 'Not found.' }, { status: 404 });
		await assertPracticeContextAccess(userId, { organizationId: attempt.organizationId });
		if (attempt.status !== 'submitted')
			return Response.json({ error: 'Exam is not submitted.' }, { status: 409 });
		const item = attempt.sections
			.filter((section) => section.kind === 'frq')
			.flatMap((section) => section.items)
			.find((item) => item.id === body.itemId);
		if (!item) return Response.json({ error: 'Item not found.' }, { status: 404 });
		if (attempt.grading[item.id]) return Response.json({ result: attempt.grading[item.id] });
		let responses: Record<string, string>;
		try {
			responses = JSON.parse(attempt.responses[item.id] ?? '{}');
		} catch {
			return Response.json({ error: 'Invalid saved response.' }, { status: 400 });
		}
		if (
			!responses ||
			typeof responses !== 'object' ||
			Array.isArray(responses) ||
			Object.values(responses).some((value) => typeof value !== 'string')
		) {
			return Response.json({ error: 'Invalid saved response.' }, { status: 400 });
		}
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
			if (!request.success)
				return Response.json({ error: 'Invalid saved response.' }, { status: 400 });
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
					if (!rate.allowed) return frqGradeRateLimitedResponse(rate.retryAt);
					result = (
						await gradeFrqAttempt(userId, request.data, {
							organizationId: attempt.organizationId
						})
					).grade;
				}
			} catch (error) {
				if (error instanceof FrqAttemptInProgressError)
					return Response.json({ error: 'Grading is still in progress.' }, { status: 409 });
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
		return Response.json({ result });
	},
	{ logLabel: 'Exam grading error', errorMessage: 'Failed to grade response' }
);
