import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import { resolveRequestPracticeContext } from '#lib/users/practice-context.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const context = await resolveRequestPracticeContext(event.locals, userId);
		const { progress } = await loadUserDashboardData(userId, event.cookies, context);
		return Response.json({ progress });
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
