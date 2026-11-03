import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getGroupMembers } from '#lib/auth/group-views.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const organizationId = event.params.organizationId?.trim();
		if (!organizationId)
			return Response.json({ error: 'Organization is required.' }, { status: 400 });
		return Response.json({ members: await getGroupMembers(userId, organizationId) });
	},
	{ logLabel: 'Group members error', errorMessage: 'Failed to load study group members' }
);
