import type { RequestHandler } from './$types';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getFrqAttemptForUser } from '#lib/grading/frq/attempts.server.js';
import { requireFrqPracticeEnabled } from '#lib/question-bank/frq/gate.server.js';
import { resolveRequestPracticeContext } from '#lib/users/practice-context.server.js';

export const GET: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		const notFound = Response.json(
			{ error: 'Written-response attempt not found' },
			{ status: 404 }
		);
		const attemptId = event.params.id;
		if (!attemptId) return notFound;
		const context = await resolveRequestPracticeContext(event.locals, userId);
		const attempt = await getFrqAttemptForUser(userId, attemptId, context.organizationId);
		if (!attempt) return notFound;
		return Response.json({ attempt });
	},
	{ logLabel: 'FRQ attempt lookup error', errorMessage: 'Failed to load written-response attempt' }
);
