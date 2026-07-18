import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { recordQuestionAttempt } from '$lib/users/record-attempt.server';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json()) as Record<string, unknown>;
		return recordQuestionAttempt(userId, body, event.request);
	},
	{ logLabel: 'Record attempt error', errorMessage: 'Failed to record attempt' }
);
