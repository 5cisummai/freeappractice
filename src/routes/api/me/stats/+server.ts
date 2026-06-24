import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { buildStatsData } from '$lib/users/stats.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'questionHistory createdAt');
		return json(buildStatsData(user));
	},
	{ logLabel: 'Stats error', errorMessage: 'Failed to fetch statistics' }
);
