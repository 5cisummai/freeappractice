import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	deleteTutorMemory,
	isTutorMemoryConfigured,
	resolveTutorMemoryId
} from '#lib/agent/memory/service.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';

export const DELETE = withAuthedHandler(
	async (event, userId) => {
		const access = await authorizeFeatureRequest(event, userId, 'memory');
		if (!access.allowed) return Response.json({ error: access.message }, { status: access.status });
		const memoryId = event.params.memoryId?.trim();
		if (!memoryId || memoryId.length > 200) {
			return Response.json({ error: 'A valid memoryId is required' }, { status: 400 });
		}
		if (!isTutorMemoryConfigured()) {
			return Response.json({ error: 'Tutor memory is not configured' }, { status: 503 });
		}

		try {
			const resolvedMemoryId = await resolveTutorMemoryId(userId, memoryId);
			if (!resolvedMemoryId)
				return Response.json({ error: 'Tutor memory was not found' }, { status: 404 });
			await deleteTutorMemory(userId, resolvedMemoryId);
		} catch (error) {
			if (error instanceof Error && error.message === 'Tutor memory was not found') {
				return Response.json({ error: 'Tutor memory was not found' }, { status: 404 });
			}
			throw error;
		}

		return Response.json({ deleted: true });
	},
	{ logLabel: 'Delete Super tutor memory error', errorMessage: 'Failed to delete tutor memory' }
);
