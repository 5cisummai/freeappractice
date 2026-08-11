import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { persistQuizAttempt } from '$lib/users/quiz-history.server';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = await event.request.json().catch(() => null);
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return json({ error: 'A valid quiz payload is required.' }, { status: 400 });
		}
		const result = await persistQuizAttempt(userId, body as Record<string, unknown>);
		return json(result.body, { status: result.status });
	},
	{ logLabel: 'Quiz history error', errorMessage: 'Failed to save quiz history' }
);
