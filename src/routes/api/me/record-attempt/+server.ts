import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { findOrCreateProgressEntry } from '$lib/users/progress.server';
import { normalizeUnit } from '$lib/questions/util.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = await event.request.json();
		const { apClass, unit, questionId, selectedAnswer, wasCorrect, timeTakenMs } = body;
		const normalizedUnit = normalizeUnit(unit, 'all-units');

		if (!apClass || !questionId || !selectedAnswer || typeof wasCorrect !== 'boolean') {
			return json(
				{ error: 'Missing required fields: apClass, questionId, selectedAnswer, wasCorrect' },
				{ status: 400 }
			);
		}

		const user = await findUserProfileOrFail(userId);

		user.questionHistory.push({
			questionId,
			apClass,
			unit: normalizedUnit,
			selectedAnswer,
			wasCorrect,
			timeTakenMs: timeTakenMs ?? 0,
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
				question_id: questionId,
				ap_class: apClass,
				unit: normalizedUnit,
				was_correct: wasCorrect,
				time_taken_ms: timeTakenMs ?? 0,
				mastery: progressEntry.mastery,
				total_attempts: progressEntry.totalAttempts
			}
		});

		return json({
			message: 'Attempt recorded successfully',
			questionId,
			mastery: progressEntry.mastery,
			totalAttempts: progressEntry.totalAttempts
		});
	},
	{ logLabel: 'Record attempt error', errorMessage: 'Failed to record attempt' }
);
