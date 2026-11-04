import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	deleteAllTutorMemories,
	getMemoryDisclosureDenial,
	publicTutorMemory,
	isTutorMemoryConfigured,
	listTutorMemories
} from '#lib/agent/memory/service.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import {
	getTutorProfileView,
	markMemoryDisclosureSeen
} from '#lib/agent/personalization/profile.server.js';
import { getTutorProfileViewForRequest } from '#lib/agent/access.server.js';

async function requireMemoryAccess(
	event: Parameters<typeof GET>[0],
	userId: string
): Promise<Response | null> {
	const access = await authorizeFeatureRequest(event, userId, 'memory');
	return access.allowed
		? null
		: Response.json({ error: access.message }, { status: access.status });
}

export const GET = withAuthedHandler(
	async (event, userId) => {
		const denial = await requireMemoryAccess(event, userId);
		if (denial) return denial;
		const profile = await getTutorProfileViewForRequest(event.locals, userId);
		const memories = await listTutorMemories(userId);
		return Response.json({
			memories: await Promise.all(memories.map((memory) => publicTutorMemory(userId, memory))),
			memory: {
				enabled: profile.memoryEnabled,
				configured: isTutorMemoryConfigured(),
				disclosureAcknowledged: Boolean(profile.memoryDisclosureSeenAt)
			}
		});
	},
	{ logLabel: 'List Super tutor memories error', errorMessage: 'Failed to list tutor memories' }
);

export const POST = withAuthedHandler(
	async (_event, userId) => {
		const denial = await getMemoryDisclosureDenial(userId);
		if (denial)
			return Response.json(
				{ error: denial.error },
				{ status: denial.reason === 'unavailable' ? 503 : 403 }
			);
		await markMemoryDisclosureSeen(userId);
		const profile = await getTutorProfileView(userId);
		return Response.json({
			acknowledged: true,
			memoryDisclosureSeenAt: profile.memoryDisclosureSeenAt,
			memoryEnabled: profile.memoryEnabled,
			configured: isTutorMemoryConfigured()
		});
	},
	{
		logLabel: 'Acknowledge Super tutor memory error',
		errorMessage: 'Failed to acknowledge tutor memory'
	}
);

export const DELETE = withAuthedHandler(
	async (event, userId) => {
		const denial = await requireMemoryAccess(event, userId);
		if (denial) return denial;
		if (!isTutorMemoryConfigured()) {
			return Response.json({ error: 'Tutor memory is not configured' }, { status: 503 });
		}

		await deleteAllTutorMemories(userId);
		return Response.json({ deleted: true });
	},
	{
		logLabel: 'Delete all Super tutor memories error',
		errorMessage: 'Failed to delete tutor memories'
	}
);
