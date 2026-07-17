import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { loadUserDashboardData } from '$lib/users/dashboard.server';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const { progress } = await loadUserDashboardData(userId, event.cookies);
		return json({ progress });
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
