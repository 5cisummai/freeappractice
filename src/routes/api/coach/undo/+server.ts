import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { requestCoachUndo } from '#lib/agent/tools/undo.server.js';

const undoSchema = z.object({ auditId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) return Response.json({ error: access.message }, { status: access.status });
		const parsed = undoSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success)
			return Response.json({ error: 'Invalid Coach undo request' }, { status: 400 });
		const result = await requestCoachUndo(
			userId,
			parsed.data.auditId,
			event.request.headers.get('idempotency-key')?.trim()
		);
		if (result.reason) {
			const statuses = { invalid_key: 400, duplicate: 409, not_found: 404, unavailable: 503 };
			return Response.json({ error: result.error }, { status: statuses[result.reason] });
		}
		return Response.json(result);
	},
	{ logLabel: 'Coach undo error', errorMessage: 'Failed to undo Coach change' }
);
