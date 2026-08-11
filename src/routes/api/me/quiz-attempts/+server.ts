import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { persistQuizAttempt } from '$lib/users/quiz-history.server';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json()) as Record<string, unknown>;
		const result = await persistQuizAttempt(userId, body);
		return json(result.body, { status: result.status });
	},
	{ logLabel: 'Quiz history error', errorMessage: 'Failed to save quiz history' }
);
