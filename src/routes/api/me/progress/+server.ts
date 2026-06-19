import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { buildProgressData } from '$lib/server/dashboard-data';
import { findUserProfileOrFail } from '$lib/server/utils';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'progress');
		return json({ progress: buildProgressData(user) });
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
