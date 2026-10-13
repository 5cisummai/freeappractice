import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const { progress } = await loadUserDashboardData(userId, event.cookies);
		return Response.json({ progress });
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
