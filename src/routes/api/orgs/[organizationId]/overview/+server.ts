import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getGroupOverview } from '#lib/auth/group-views.server.js';
import { timezoneFromRequest } from '#lib/users/timezone.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const organizationId = event.params.organizationId?.trim();
		if (!organizationId)
			return Response.json({ error: 'Organization is required.' }, { status: 400 });
		const timeZone = timezoneFromRequest(event.request, event.cookies);
		return Response.json(await getGroupOverview(userId, organizationId, timeZone));
	},
	{ logLabel: 'Group overview error', errorMessage: 'Failed to load study group' }
);
