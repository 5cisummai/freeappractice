import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { clearPracticeDataForUser } from '$lib/users/clear-practice-data.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';

export const DELETE = withAuthedHandler(
	async (event, userId) => {
		await clearPracticeDataForUser(userId);

		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'practice_data_cleared'
		});

		return json({ message: 'Practice data cleared' });
	},
	{ logLabel: 'Clear practice data error', errorMessage: 'Failed to clear practice data' }
);
