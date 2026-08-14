import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { authorizeCoachWrites, RedisRequiredError } from '$lib/super/ai-controls.server';

const approvalSchema = z
	.object({
		sessionId: z.string().uuid(),
		categories: z
			.array(z.enum(['goals', 'study_plans']))
			.min(1)
			.max(2)
	})
	.strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) return json({ error: access.message }, { status: access.status });
		const parsed = approvalSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid Coach approval' }, { status: 400 });
		try {
			await authorizeCoachWrites(userId, parsed.data.sessionId, parsed.data.categories);
			return json({ approved: true, expiresInSeconds: 30 * 60 });
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return json({ error: 'Coach approvals are temporarily unavailable.' }, { status: 503 });
			}
			throw error;
		}
	},
	{ logLabel: 'Coach approval error', errorMessage: 'Failed to approve Coach changes' }
);
