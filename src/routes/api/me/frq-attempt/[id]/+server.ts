import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { getFrqAttemptForUser } from '$lib/frq/attempts.server';
import { isFrqPracticeEnabled } from '$lib/flags';

export const GET: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		if (!(await isFrqPracticeEnabled())) {
			return json({ error: 'Written-response practice is unavailable' }, { status: 404 });
		}
		const attemptId = event.params.id;
		if (!attemptId) return json({ error: 'Written-response attempt not found' }, { status: 404 });
		const attempt = await getFrqAttemptForUser(userId, attemptId);
		return attempt
			? json({ attempt })
			: json({ error: 'Written-response attempt not found' }, { status: 404 });
	},
	{ logLabel: 'FRQ attempt lookup error', errorMessage: 'Failed to load written-response attempt' }
);
