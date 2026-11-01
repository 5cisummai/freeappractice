import { sanitizeAttemptTimeMs } from '#lib/users/attempt-time.js';
import {
	AttemptContextConflictError,
	persistQuestionAttempt
} from '#lib/users/attempt-write.server.js';
import { capturePostHogServerEvent } from '#lib/server/posthog.js';
import { getQuestionById } from '#lib/question-bank/mcq/repository.server.js';
import type { IQuestionAttempt } from '#lib/users/records.server.js';
import {
	requirePracticeSession,
	resolvePracticeContext
} from '#lib/users/practice-context.server.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';

const ANSWER_CHOICES = new Set(['A', 'B', 'C', 'D']);

function normalizeAnswerLetter(value: unknown): 'A' | 'B' | 'C' | 'D' | null {
	if (typeof value !== 'string') return null;
	const letter = value.trim().toUpperCase();
	return ANSWER_CHOICES.has(letter) ? (letter as 'A' | 'B' | 'C' | 'D') : null;
}

export type RecordAttemptResult =
	| {
			status: 200;
			body: { message: string; questionId: string; mastery: number; totalAttempts: number };
	  }
	| { status: number; body: { error: string } };

export async function recordQuestionAttempt(
	userId: string,
	body: Record<string, unknown>,
	request: Request
): Promise<RecordAttemptResult> {
	const { questionId, selectedAnswer, timeTakenMs } = body;
	const attemptId = typeof body.attemptId === 'string' ? body.attemptId.trim() : '';
	const practiceSessionId =
		typeof body.practiceSessionId === 'string' ? body.practiceSessionId.trim() : '';
	const normalizedQuestionId = typeof questionId === 'string' ? questionId.trim() : '';
	const elapsedTimeMs = sanitizeAttemptTimeMs(timeTakenMs);

	let context = { organizationId: null as string | null };
	let sessionCourse: string | null = null;
	if (practiceSessionId) {
		try {
			const session = await requirePracticeSession(userId, practiceSessionId);
			if (session.mode !== 'mcq' && session.mode !== 'quiz') {
				return { status: 400, body: { error: 'This session cannot record an MCQ answer.' } };
			}
			context = { organizationId: session.organizationId };
			sessionCourse = session.course;
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return { status: 403, body: { error: error.message } };
			}
			throw error;
		}
	} else if (body.organizationId !== undefined && body.organizationId !== null) {
		return {
			status: 400,
			body: { error: 'A practice session is required for classroom practice.' }
		};
	}

	if (!normalizedQuestionId) {
		return {
			status: 400,
			body: { error: 'Missing required fields: questionId and selectedAnswer' }
		};
	}
	if (
		attemptId &&
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)
	) {
		return { status: 400, body: { error: 'Invalid attempt ID' } };
	}

	const letter = normalizeAnswerLetter(selectedAnswer);
	if (!letter) {
		return {
			status: 400,
			body: { error: 'Missing required fields: questionId and selectedAnswer' }
		};
	}

	const question = await getQuestionById(normalizedQuestionId).catch(() => null);
	if (!question) {
		return { status: 404, body: { error: 'Question metadata was not found' } };
	}

	const course = typeof question.course === 'string' ? question.course.trim() : '';
	const normalizedUnit = question.unit?.trim() ?? '';
	if (!course || !normalizedUnit) {
		return { status: 422, body: { error: 'Question metadata is missing class or unit' } };
	}
	if (sessionCourse && course !== sessionCourse) {
		return {
			status: 400,
			body: { error: 'This question is outside the practice session course.' }
		};
	}

	const wasCorrect = letter === question.correctAnswer;
	const attempt: IQuestionAttempt = {
		questionId: normalizedQuestionId,
		course,
		unit: normalizedUnit,
		selectedAnswer: letter,
		wasCorrect,
		timeTakenMs: elapsedTimeMs,
		attemptedAt: new Date()
	};

	let progress: Awaited<ReturnType<typeof persistQuestionAttempt>>;
	try {
		progress = await persistQuestionAttempt(userId, attempt, attemptId || undefined, {
			context,
			practiceSessionId: practiceSessionId || undefined
		});
	} catch (error) {
		if (error instanceof AttemptContextConflictError) {
			return { status: 400, body: { error: error.message } };
		}
		throw error;
	}

	if (progress.newlyRecorded)
		capturePostHogServerEvent(request, {
			distinctId: userId,
			event: 'question_attempt_recorded',
			properties: {
				question_id: normalizedQuestionId,
				course: course,
				unit: normalizedUnit,
				was_correct: attempt.wasCorrect,
				time_taken_ms: elapsedTimeMs,
				mastery: progress.mastery,
				total_attempts: progress.totalAttempts
			}
		});

	return {
		status: 200,
		body: {
			message: 'Attempt recorded successfully',
			questionId: normalizedQuestionId,
			mastery: progress.mastery,
			totalAttempts: progress.totalAttempts
		}
	};
}
