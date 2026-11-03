import { sanitizeAttemptTimeMs } from '#lib/users/attempt-time.js';
import {
	AttemptContextConflictError,
	persistQuestionAttempt
} from '#lib/users/attempt-write.server.js';
import { getQuestionById } from '#lib/question-bank/mcq/repository.server.js';
import type { IQuestionAttempt } from '#lib/users/records.server.js';
import { requirePracticeSession } from '#lib/users/practice-context.server.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';

const ANSWER_CHOICES = new Set(['A', 'B', 'C', 'D']);

function normalizeAnswerLetter(value: unknown): 'A' | 'B' | 'C' | 'D' | null {
	if (typeof value !== 'string') return null;
	const letter = value.trim().toUpperCase();
	return ANSWER_CHOICES.has(letter) ? (letter as 'A' | 'B' | 'C' | 'D') : null;
}

export type RecordAttemptInput = {
	questionId?: unknown;
	selectedAnswer?: unknown;
	timeTakenMs?: unknown;
	attemptId?: unknown;
	practiceSessionId?: unknown;
	organizationId?: unknown;
};

export type RecordAttemptResult =
	| {
			ok: true;
			questionId: string;
			mastery: number;
			totalAttempts: number;
			newlyRecorded: boolean;
			course: string;
			unit: string;
			wasCorrect: boolean;
			timeTakenMs: number | undefined;
	  }
	| { ok: false; code: 'invalid' | 'forbidden' | 'not_found' | 'invalid_metadata'; error: string };

export async function recordQuestionAttempt(
	userId: string,
	body: RecordAttemptInput
): Promise<RecordAttemptResult> {
	const { questionId, selectedAnswer, timeTakenMs } = body;
	const attemptId = typeof body.attemptId === 'string' ? body.attemptId.trim() : '';
	const practiceSessionId =
		typeof body.practiceSessionId === 'string' ? body.practiceSessionId.trim() : '';
	const normalizedQuestionId = typeof questionId === 'string' ? questionId.trim() : '';
	const elapsedTimeMs = sanitizeAttemptTimeMs(timeTakenMs);

	// Attempts without a practice session always use the personal namespace.
	// Classroom practice requires an authorized practiceSessionId; the session
	// active organization alone cannot switch attempt writes to classroom data.
	let context = { organizationId: null as string | null };
	let sessionCourse: string | null = null;
	if (practiceSessionId) {
		try {
			const session = await requirePracticeSession(userId, practiceSessionId);
			if (session.mode !== 'mcq' && session.mode !== 'quiz') {
				return { ok: false, code: 'invalid', error: 'This session cannot record an MCQ answer.' };
			}
			context = { organizationId: session.organizationId };
			sessionCourse = session.course;
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return { ok: false, code: 'forbidden', error: error.message };
			}
			throw error;
		}
	} else if (body.organizationId !== undefined && body.organizationId !== null) {
		return {
			ok: false,
			code: 'invalid',
			error: 'A practice session is required for classroom practice.'
		};
	}

	if (!normalizedQuestionId) {
		return {
			ok: false,
			code: 'invalid',
			error: 'Missing required fields: questionId and selectedAnswer'
		};
	}
	if (
		attemptId &&
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)
	) {
		return { ok: false, code: 'invalid', error: 'Invalid attempt ID' };
	}

	const letter = normalizeAnswerLetter(selectedAnswer);
	if (!letter) {
		return {
			ok: false,
			code: 'invalid',
			error: 'Missing required fields: questionId and selectedAnswer'
		};
	}

	const question = await getQuestionById(normalizedQuestionId).catch(() => null);
	if (!question) {
		return { ok: false, code: 'not_found', error: 'Question metadata was not found' };
	}

	const course = typeof question.course === 'string' ? question.course.trim() : '';
	const normalizedUnit = question.unit?.trim() ?? '';
	if (!course || !normalizedUnit) {
		return {
			ok: false,
			code: 'invalid_metadata',
			error: 'Question metadata is missing class or unit'
		};
	}
	if (sessionCourse && course !== sessionCourse) {
		return {
			ok: false,
			code: 'invalid',
			error: 'This question is outside the practice session course.'
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
			return { ok: false, code: 'invalid', error: error.message };
		}
		throw error;
	}

	return {
		ok: true,
		questionId: normalizedQuestionId,
		mastery: progress.mastery,
		totalAttempts: progress.totalAttempts,
		newlyRecorded: progress.newlyRecorded,
		course,
		unit: normalizedUnit,
		wasCorrect,
		timeTakenMs: elapsedTimeMs
	};
}
