import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { undoCoachAudit } from '$lib/super/coach.server';
import { getSuperFeatureAccess, superFeatureAccessMessage } from '$lib/super/feature-access.server';

const undoSchema = z.object({ auditId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await getSuperFeatureAccess(userId, 'coach');
		if (!access.allowed)
			return json({ error: superFeatureAccessMessage(access, 'Coach') }, { status: 403 });
		const parsed = undoSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid Coach undo request' }, { status: 400 });
		const undone = await undoCoachAudit(userId, parsed.data.auditId);
		return undone
			? json({ undone: true })
			: json({ error: 'Coach change was not found' }, { status: 404 });
	},
	{ logLabel: 'Coach undo error', errorMessage: 'Failed to undo Coach change' }
);
