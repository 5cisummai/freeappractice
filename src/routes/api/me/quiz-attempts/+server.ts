import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { persistQuizAttempt } from '#lib/users/quiz-history.server.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = await event.request.json().catch(() => null);
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return Response.json({ error: 'A valid quiz payload is required.' }, { status: 400 });
		}
		const result = await persistQuizAttempt(userId, body as Record<string, unknown>);
		if (!result.ok) {
			const status = {
				invalid: 400,
				forbidden: 403,
				not_found: 404,
				conflict: 409,
				invalid_metadata: 422
			}[result.code];
			return Response.json({ error: result.error }, { status });
		}
		return Response.json({
			message: 'Quiz saved to history.',
			quizId: result.quizId,
			requestedCount: result.requestedCount,
			answeredCount: result.answeredCount,
			correctCount: result.correctCount,
			scorePercent: result.scorePercent
		});
	},
	{ logLabel: 'Quiz history error', errorMessage: 'Failed to save quiz history' }
);
