import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { findOrCreateProgressEntry } from '$lib/users/progress.server';
import { normalizeUnit } from '$lib/questions/util.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { getQuestionFromS3 } from '$lib/questions/storage.server';

const answerChoices = new Set(['A', 'B', 'C', 'D']);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = await event.request.json();
		const { questionId, selectedAnswer, timeTakenMs } = body;
		const normalizedQuestionId = typeof questionId === 'string' ? questionId.trim() : '';
		const normalizedAnswer =
			typeof selectedAnswer === 'string' ? selectedAnswer.trim().toUpperCase() : '';
		const elapsedTimeMs =
			typeof timeTakenMs === 'number' && Number.isFinite(timeTakenMs) && timeTakenMs >= 0
				? timeTakenMs
				: 0;

		if (!normalizedQuestionId || !answerChoices.has(normalizedAnswer)) {
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

		const wasCorrect = normalizedAnswer === question.correctAnswer;
		const user = await findUserProfileOrFail(userId);

		user.questionHistory.push({
			questionId: normalizedQuestionId,
			apClass,
			unit: normalizedUnit,
			selectedAnswer: normalizedAnswer as 'A' | 'B' | 'C' | 'D',
			wasCorrect,
			timeTakenMs: elapsedTimeMs,
			attemptedAt: new Date()
		});

		const progressEntry = findOrCreateProgressEntry(user.progress, apClass, normalizedUnit);

		progressEntry.totalAttempts++;
		if (wasCorrect) progressEntry.correctAttempts++;
		progressEntry.mastery = Math.round(
			(progressEntry.correctAttempts / progressEntry.totalAttempts) * 100
		);
		progressEntry.lastAttemptAt = new Date();

		await user.save();

		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'question_attempt_recorded',
			properties: {
				question_id: normalizedQuestionId,
				ap_class: apClass,
				unit: normalizedUnit,
				was_correct: wasCorrect,
				time_taken_ms: elapsedTimeMs,
				mastery: progressEntry.mastery,
				total_attempts: progressEntry.totalAttempts
			}
		});

		return json({
			message: 'Attempt recorded successfully',
			questionId: normalizedQuestionId,
			mastery: progressEntry.mastery,
			totalAttempts: progressEntry.totalAttempts
		});
	},
	{ logLabel: 'Record attempt error', errorMessage: 'Failed to record attempt' }
);
