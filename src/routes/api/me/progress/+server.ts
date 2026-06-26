import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { buildProgressData } from '$lib/users/progress.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'progress');
		return json({ progress: buildProgressData(user) });
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
