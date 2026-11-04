import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	getPlanAccessForRequest,
	getTutorProfileViewForRequest
} from '#lib/agent/access.server.js';
import { getUserSettings } from '#lib/users/settings.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const [planAccess, profile] = await Promise.all([
			getPlanAccessForRequest(event.locals, userId),
			getTutorProfileViewForRequest(event.locals, userId)
		]);
		return Response.json(await getUserSettings(userId, planAccess, profile));
	},
	{ logLabel: 'Settings error', errorMessage: 'Failed to load settings' }
);
