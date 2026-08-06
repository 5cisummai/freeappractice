import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { confirmAge } from '$lib/super/profile.server';

export const POST = withAuthedHandler(
	async (_event, userId) => {
		const profile = await confirmAge(userId);
		return json({ confirmed: true, ageConfirmedAt: profile.ageConfirmedAt });
	},
	{ logLabel: 'Confirm Super tutor age error', errorMessage: 'Failed to confirm age' }
);
