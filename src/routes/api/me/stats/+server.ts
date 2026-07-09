import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { buildStatsData } from '$lib/users/stats.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { timezoneFromCookies } from '$lib/users/timezone';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const user = await findUserProfileOrFail(userId, 'questionHistory createdAt');
		return json(buildStatsData(user, timezoneFromCookies(event.cookies)));
	},
	{ logLabel: 'Stats error', errorMessage: 'Failed to fetch statistics' }
);
