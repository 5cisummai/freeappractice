import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { claimIdempotencyKey, RedisRequiredError } from '$lib/super/ai-controls.server';
import { undoCoachAudit } from '$lib/super/coach.server';

const undoSchema = z.object({ auditId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) return json({ error: access.message }, { status: access.status });
		const parsed = undoSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid Coach undo request' }, { status: 400 });
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
		if (!idempotencyKey || idempotencyKey.length > 200) {
			return json({ error: 'An idempotency key is required.' }, { status: 400 });
		}
		try {
			if (!(await claimIdempotencyKey(userId, `coach-undo:${idempotencyKey}`))) {
				return json({ error: 'This Coach undo was already requested.' }, { status: 409 });
			}
			const undone = await undoCoachAudit(userId, parsed.data.auditId);
			return undone
				? json({ undone: true })
				: json({ error: 'Coach change was not found' }, { status: 404 });
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return json({ error: 'Coach undo is temporarily unavailable.' }, { status: 503 });
			}
			throw error;
		}
	},
	{ logLabel: 'Coach undo error', errorMessage: 'Failed to undo Coach change' }
);
