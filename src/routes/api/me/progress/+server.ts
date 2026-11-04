import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { loadUserDashboardData } from '#lib/users/dashboard.server.js';
import { resolveApiPracticeContext } from '#lib/users/practice-context.server.js';
import { timezoneFromRequest } from '#lib/users/timezone.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const context = await resolveApiPracticeContext(event, userId);
		const timeZone = timezoneFromRequest(event.request, event.cookies);
		const { progress } = await loadUserDashboardData(userId, timeZone, context);
		return Response.json({ progress });
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
