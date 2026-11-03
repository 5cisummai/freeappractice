import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { capturePostHogServerEvent } from '#lib/server/posthog.js';
import { recordQuestionAttempt } from '#lib/users/record-attempt.server.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json()) as Record<string, unknown>;
		const result = await recordQuestionAttempt(userId, body);
		if (!result.ok) {
			const status = { invalid: 400, forbidden: 403, not_found: 404, invalid_metadata: 422 }[
				result.code
			];
			return Response.json({ error: result.error }, { status });
		}
		if (result.newlyRecorded) {
			capturePostHogServerEvent(event.request, {
				distinctId: userId,
				event: 'question_attempt_recorded',
				properties: {
					question_id: result.questionId,
					course: result.course,
					unit: result.unit,
					was_correct: result.wasCorrect,
					time_taken_ms: result.timeTakenMs,
					mastery: result.mastery,
					total_attempts: result.totalAttempts
				}
			});
		}
		return Response.json({
			message: 'Attempt recorded successfully',
			questionId: result.questionId,
			mastery: result.mastery,
			totalAttempts: result.totalAttempts
		});
	},
	{ logLabel: 'Record attempt error', errorMessage: 'Failed to record attempt' }
);
