import {
	buildAttemptFieldsFromMultiAttempt,
	hasPracticeExperimentMetadata,
	hasValidHints,
	isMultiAttemptRequestBody,
	normalizeAnswerLetter,
	resolveDisplayedVariant,
	validateMultiAttemptPayload
} from '$lib/practice/multi-attempt';
import { getOrAssignMultiAttemptVariant } from '$lib/practice/assign-variant.server';
import { sanitizeAttemptTimeMs } from '$lib/users/attempt-time';
import { persistQuestionAttempt } from '$lib/users/attempt-write.server';
import { normalizeUnit } from '$lib/questions/util.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { getQuestionById } from '$lib/questions/repository.server';
import type { IQuestionAttempt } from '$lib/users/records.server';

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
	// Correctness is derived server-side from the canonical Neon question row.
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

	const question = await getQuestionById(normalizedQuestionId).catch(() => null);
	if (!question) {
		return { status: 404, body: { error: 'Question metadata was not found' } };
	}

	const apClass = typeof question.apClass === 'string' ? question.apClass.trim() : '';
	const normalizedUnit = normalizeUnit(question.unit);
	if (!apClass || !normalizedUnit) {
		return { status: 422, body: { error: 'Question metadata is missing class or unit' } };
	}

	const experimentRequest = hasPracticeExperimentMetadata(body);
	const experimentContext = experimentRequest ? await getOrAssignMultiAttemptVariant(userId) : null;
	const displayedExperiment = experimentContext
		? resolveDisplayedVariant({
				assigned: experimentContext.assigned,
				experimentEnabled: experimentContext.enabled,
				questionHasHints: hasValidHints({
					hint1: typeof question.hint1 === 'string' ? question.hint1 : null,
					hint2: typeof question.hint2 === 'string' ? question.hint2 : null
				})
			})
		: null;
	const clientVariant = body.displayedVariant;
	if (
		experimentContext &&
		clientVariant !== undefined &&
		clientVariant !== displayedExperiment?.displayed
	) {
		return {
			status: 400,
			body: { error: 'Displayed experiment variant does not match the server assignment' }
		};
	}
	if (
		experimentContext &&
		isMultiAttemptRequestBody(body) !== (displayedExperiment?.displayed === 'multi_attempt_hints')
	) {
		return {
			status: 400,
			body: { error: 'Inconsistent experiment payload for the displayed variant' }
		};
	}
	let attempt: IQuestionAttempt;

	if (isMultiAttemptRequestBody(body)) {
		const validated = validateMultiAttemptPayload(body, question.correctAnswer);
		if (!validated.ok) {
			return { status: 400, body: { error: validated.error } };
		}
		const fields = buildAttemptFieldsFromMultiAttempt(
			{
				...validated.data,
				displayedVariant: displayedExperiment!.displayed,
				experimentKey: experimentContext!.assignment.key,
				experimentVersion: experimentContext!.assignment.version
			},
			question.correctAnswer
		);
		attempt = {
			questionId: normalizedQuestionId,
			apClass,
			unit: normalizedUnit,
			selectedAnswer: fields.selectedAnswer,
			wasCorrect: fields.wasCorrect,
			timeTakenMs: elapsedTimeMs,
			attemptedAt: new Date(),
			finalAnswer: fields.finalAnswer,
			answerCount: fields.answerCount,
			hintsShown: fields.hintsShown,
			terminalOutcome: fields.terminalOutcome,
			experimentKey: fields.experimentKey,
			experimentVersion: fields.experimentVersion,
			displayedVariant: fields.displayedVariant
		};
	} else {
		// Classic control path — identical contract to pre-multi-attempt clients.
		const letter = normalizeAnswerLetter(selectedAnswer);
		if (!letter) {
			return {
				status: 400,
				body: { error: 'Missing required fields: questionId and selectedAnswer' }
			};
		}
		const wasCorrect = letter === question.correctAnswer;
		attempt = {
			questionId: normalizedQuestionId,
			apClass,
			unit: normalizedUnit,
			selectedAnswer: letter,
			wasCorrect,
			timeTakenMs: elapsedTimeMs,
			attemptedAt: new Date(),
			...(experimentContext
				? {
						experimentKey: experimentContext.assignment.key,
						experimentVersion: experimentContext.assignment.version,
						displayedVariant: displayedExperiment!.displayed
					}
				: {})
		};
	}

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
				total_attempts: progress.totalAttempts,
				...(attempt.displayedVariant
					? {
							displayed_variant: attempt.displayedVariant,
							terminal_outcome: attempt.terminalOutcome,
							answer_count: attempt.answerCount,
							hints_shown: attempt.hintsShown
						}
					: {})
			}
		});

	// Response shape stays backwards compatible; extras are additive only.
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
