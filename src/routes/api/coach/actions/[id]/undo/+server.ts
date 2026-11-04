import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { requestCoachUndo } from '#lib/agent/tools/undo.server.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) return Response.json({ error: access.message }, { status: access.status });
		const auditId = event.params.id;
		if (!auditId || !/^[a-f\d]{24}$/i.test(auditId))
			return Response.json({ error: 'Invalid Coach undo request' }, { status: 400 });
		const result = await requestCoachUndo(
			userId,
			auditId,
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
