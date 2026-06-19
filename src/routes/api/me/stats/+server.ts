import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { buildStatsData } from '$lib/server/dashboard-data';
import { findUserProfileOrFail } from '$lib/server/utils';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'questionHistory createdAt');
		return json(buildStatsData(user));
	},
	{ logLabel: 'Stats error', errorMessage: 'Failed to fetch statistics' }
);
