import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { loadUserDashboardData } from '$lib/users/dashboard.server';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const { stats } = await loadUserDashboardData(userId, event.cookies);
		return json(stats);
	},
	{ logLabel: 'Stats error', errorMessage: 'Failed to fetch statistics' }
);
