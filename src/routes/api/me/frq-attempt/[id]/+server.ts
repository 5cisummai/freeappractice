import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { getFrqAttemptForUser } from '$lib/frq/attempts.server';
import { requireFrqPracticeEnabled } from '$lib/frq/gate.server';

export const GET: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		const notFound = json({ error: 'Written-response attempt not found' }, { status: 404 });
		const attemptId = event.params.id;
		if (!attemptId) return notFound;
		const attempt = await getFrqAttemptForUser(userId, attemptId);
		if (!attempt) return notFound;
		return json({ attempt });
	},
	{ logLabel: 'FRQ attempt lookup error', errorMessage: 'Failed to load written-response attempt' }
);
