import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { recordQuestionAttempt } from '#lib/users/record-attempt.server.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json()) as Record<string, unknown>;
		const result = await recordQuestionAttempt(userId, body, event.request);
		return Response.json(result.body, { status: result.status });
	},
	{ logLabel: 'Record attempt error', errorMessage: 'Failed to record attempt' }
);
