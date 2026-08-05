import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { deleteTutorMemory, isTutorMemoryConfigured } from '$lib/mem0/service.server';

export const DELETE = withAuthedHandler(
	async (event, userId) => {
		const memoryId = event.params.memoryId?.trim();
		if (!memoryId || memoryId.length > 200) {
			return json({ error: 'A valid memoryId is required' }, { status: 400 });
		}
		if (!isTutorMemoryConfigured()) {
			return json({ error: 'Tutor memory is not configured' }, { status: 503 });
		}

		try {
			await deleteTutorMemory(userId, memoryId);
		} catch (error) {
			if (error instanceof Error && error.message === 'Tutor memory was not found') {
				return json({ error: 'Tutor memory was not found' }, { status: 404 });
			}
			throw error;
		}

		return json({ deleted: true });
	},
	{ logLabel: 'Delete Super tutor memory error', errorMessage: 'Failed to delete tutor memory' }
);
