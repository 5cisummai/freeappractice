import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { findUserOrFail } from '$lib/server/utils';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserOrFail(userId, 'progress');
		return json({ progress: user.progress });
	},
	{ logLabel: 'Progress error', errorMessage: 'Failed to get progress' }
);
