import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isSuperInsightsEnabled } from '$lib/flags';
import { claimIdempotencyKey, RedisRequiredError } from '$lib/super/ai-controls.server';
import { getSuperFeatureAccess, superFeatureAccessMessage } from '$lib/super/feature-access.server';
import { undoStudyPlanAudit } from '$lib/super/study-plan-audit.server';

const undoSchema = z.object({ auditId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		if (!(await isSuperInsightsEnabled()))
			return json({ error: 'Study plans are temporarily unavailable.' }, { status: 503 });
		const access = await getSuperFeatureAccess(userId, 'studyPlans');
		if (!access.allowed)
			return json(
				{ error: superFeatureAccessMessage(access, 'Super study plans') },
				{ status: 403 }
			);
		const parsed = undoSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid study-plan undo request' }, { status: 400 });
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
		if (!idempotencyKey || idempotencyKey.length > 200) {
			return json({ error: 'An idempotency key is required.' }, { status: 400 });
		}
		try {
			if (!(await claimIdempotencyKey(userId, `study-plan-undo:${idempotencyKey}`))) {
				return json({ error: 'This study-plan undo was already requested.' }, { status: 409 });
			}
			const undone = await undoStudyPlanAudit(userId, parsed.data.auditId);
			return undone
				? json({ undone: true })
				: json({ error: 'This study-plan change can no longer be undone.' }, { status: 409 });
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return json({ error: 'Study-plan undo is temporarily unavailable.' }, { status: 503 });
			}
			throw error;
		}
	},
	{ logLabel: 'Study plan undo error', errorMessage: 'Failed to undo study-plan change' }
);
