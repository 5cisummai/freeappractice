import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import { resolveRequestPracticeContext } from '#lib/users/practice-context.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const context = await resolveRequestPracticeContext(event.locals, userId);
		const { stats } = await loadUserDashboardData(userId, event.cookies, context);
		return Response.json(stats);
	},
	{ logLabel: 'Stats error', errorMessage: 'Failed to fetch statistics' }
);
