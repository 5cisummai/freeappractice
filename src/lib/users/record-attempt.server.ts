import { sanitizeAttemptTimeMs } from '$lib/users/attempt-time';
import { persistQuestionAttempt } from '$lib/users/attempt-write.server';
import { normalizeUnit } from '$lib/question-bank/util.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { getQuestionById } from '$lib/question-bank/mcq/repository.server';
import type { IQuestionAttempt } from '$lib/users/records.server';

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
	const normalizedQuestionId = typeof questionId === 'string' ? questionId.trim() : '';
	const elapsedTimeMs = sanitizeAttemptTimeMs(timeTakenMs);

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

	const apClass = typeof question.apClass === 'string' ? question.apClass.trim() : '';
	const normalizedUnit = normalizeUnit(question.unit);
	if (!apClass || !normalizedUnit) {
		return { status: 422, body: { error: 'Question metadata is missing class or unit' } };
	}

	const wasCorrect = letter === question.correctAnswer;
	const attempt: IQuestionAttempt = {
		questionId: normalizedQuestionId,
		apClass,
		unit: normalizedUnit,
		selectedAnswer: letter,
		wasCorrect,
		timeTakenMs: elapsedTimeMs,
		attemptedAt: new Date()
	};

	const progress = await persistQuestionAttempt(userId, attempt, attemptId || undefined);
	if (progress.referralActivated) {
		capturePostHogServerEvent(request, {
			distinctId: userId,
			event: 'referral_activated',
			properties: { source: 'first_attempt' }
		});
	}

	if (progress.newlyRecorded)
		capturePostHogServerEvent(request, {
			distinctId: userId,
			event: 'question_attempt_recorded',
			properties: {
				question_id: normalizedQuestionId,
				ap_class: apClass,
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
