import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import {
	deleteTutorMemory,
	isTutorMemoryConfigured,
	resolveTutorMemoryId
} from '$lib/mem0/service.server';
import { isSuperMemoryEnabled } from '$lib/flags';
import { getSuperFeatureAccess, superFeatureAccessMessage } from '$lib/super/feature-access.server';

export const DELETE = withAuthedHandler(
	async (event, userId) => {
		if (!(await isSuperMemoryEnabled())) {
			return json({ error: 'Tutor memory is temporarily unavailable.' }, { status: 503 });
		}
		const access = await getSuperFeatureAccess(userId, 'memory');
		if (!access.allowed)
			return json(
				{ error: superFeatureAccessMessage(access, 'Super tutor memory') },
				{ status: 403 }
			);
		const memoryId = event.params.memoryId?.trim();
		if (!memoryId || memoryId.length > 200) {
			return json({ error: 'A valid memoryId is required' }, { status: 400 });
		}
		if (!isTutorMemoryConfigured()) {
			return json({ error: 'Tutor memory is not configured' }, { status: 503 });
		}

		try {
			const resolvedMemoryId = await resolveTutorMemoryId(userId, memoryId);
			if (!resolvedMemoryId) return json({ error: 'Tutor memory was not found' }, { status: 404 });
			await deleteTutorMemory(userId, resolvedMemoryId);
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
