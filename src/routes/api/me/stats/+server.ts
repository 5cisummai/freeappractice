import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const { stats } = await loadUserDashboardData(userId, event.cookies);
		return Response.json(stats);
	},
	{ logLabel: 'Stats error', errorMessage: 'Failed to fetch statistics' }
);
