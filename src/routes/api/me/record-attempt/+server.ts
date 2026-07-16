import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
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
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { findOrCreateProgressEntry } from '$lib/users/progress.server';
import { normalizeUnit } from '$lib/questions/util.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { getQuestionFromS3 } from '$lib/questions/storage.server';
import { activateReferralForUser } from '$lib/referrals/referrals.server';
import type { IQuestionAttempt } from '$lib/users/records.server';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json()) as Record<string, unknown>;
		const { questionId, selectedAnswer, timeTakenMs } = body;
		const normalizedQuestionId = typeof questionId === 'string' ? questionId.trim() : '';
		// Correctness is derived server-side from S3; only clamp client-reported duration.
		const elapsedTimeMs = sanitizeAttemptTimeMs(timeTakenMs);

		if (!normalizedQuestionId) {
			return json(
				{ error: 'Missing required fields: questionId and selectedAnswer' },
				{ status: 400 }
			);
		}

		const question = await getQuestionFromS3(normalizedQuestionId).catch(() => null);
		if (!question) {
			return json({ error: 'Question metadata was not found' }, { status: 404 });
		}

		const apClass = typeof question.apClass === 'string' ? question.apClass.trim() : '';
		const normalizedUnit = normalizeUnit(question.unit);
		if (!apClass || !normalizedUnit) {
			return json({ error: 'Question metadata is missing class or unit' }, { status: 422 });
		}

		const user = await findUserProfileOrFail(userId);
		const experimentRequest = hasPracticeExperimentMetadata(body);
		const experimentContext = experimentRequest
			? await getOrAssignMultiAttemptVariant(userId)
			: null;
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
			return json(
				{ error: 'Displayed experiment variant does not match the server assignment' },
				{ status: 400 }
			);
		}
		if (
			experimentContext &&
			isMultiAttemptRequestBody(body) !== (displayedExperiment?.displayed === 'multi_attempt_hints')
		) {
			return json(
				{ error: 'Inconsistent experiment payload for the displayed variant' },
				{ status: 400 }
			);
		}
		let attempt: IQuestionAttempt;

		if (isMultiAttemptRequestBody(body)) {
			const validated = validateMultiAttemptPayload(body, question.correctAnswer);
			if (!validated.ok) {
				return json({ error: validated.error }, { status: 400 });
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
				return json(
					{ error: 'Missing required fields: questionId and selectedAnswer' },
					{ status: 400 }
				);
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

		user.questionHistory.push(attempt);

		const progressEntry = findOrCreateProgressEntry(user.progress, apClass, normalizedUnit);

		progressEntry.totalAttempts++;
		if (attempt.wasCorrect) progressEntry.correctAttempts++;
		progressEntry.mastery = Math.round(
			(progressEntry.correctAttempts / progressEntry.totalAttempts) * 100
		);
		progressEntry.lastAttemptAt = new Date();

		await user.save();
		await activateReferralForUser(userId, event.request);

		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'question_attempt_recorded',
			properties: {
				question_id: normalizedQuestionId,
				ap_class: apClass,
				unit: normalizedUnit,
				was_correct: attempt.wasCorrect,
				time_taken_ms: elapsedTimeMs,
				mastery: progressEntry.mastery,
				total_attempts: progressEntry.totalAttempts,
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
		return json({
			message: 'Attempt recorded successfully',
			questionId: normalizedQuestionId,
			mastery: progressEntry.mastery,
			totalAttempts: progressEntry.totalAttempts
		});
	},
	{ logLabel: 'Record attempt error', errorMessage: 'Failed to record attempt' }
);
