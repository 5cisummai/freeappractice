import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { clearPracticeDataForUser } from '#lib/users/clear-practice-data.server.js';
import { capturePostHogServerEvent } from '#lib/server/posthog.js';

export const DELETE = withAuthedHandler(
	async (event, userId) => {
		await clearPracticeDataForUser(userId);

		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'practice_data_cleared'
		});

		return Response.json({ message: 'Practice data cleared' });
	},
	{ logLabel: 'Clear practice data error', errorMessage: 'Failed to clear practice data' }
);
