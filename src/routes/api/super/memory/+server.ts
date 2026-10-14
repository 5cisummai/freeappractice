import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	deleteAllTutorMemories,
	getTutorMemoryPublicId,
	isTutorMemoryConfigured,
	listTutorMemories
} from '#lib/agent/memory/service.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { isSuperMemoryEnabled } from '#lib/flags.js';
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

async function requireMemoryDisclosureAccess(userId: string): Promise<Response | null> {
	if (!(await isSuperMemoryEnabled())) {
		return Response.json({ error: 'Tutor memory is temporarily unavailable.' }, { status: 503 });
	}
	const profile = await getTutorProfileView(userId);
	if (!profile.ageConfirmedAt) {
		return Response.json(
			{ error: 'Confirm that you are at least 13 to use Super tutor memory.' },
			{ status: 403 }
		);
	}
	return null;
}

async function publicMemory(
	userId: string,
	memory: { id: string; text: string; createdAt: string | null }
) {
	return {
		id: await getTutorMemoryPublicId(userId, memory.id),
		text: memory.text,
		createdAt: memory.createdAt
	};
}

export const GET = withAuthedHandler(
	async (event, userId) => {
		const denial = await requireMemoryAccess(event, userId);
		if (denial) return denial;
		const profile = await getTutorProfileViewForRequest(event.locals, userId);
		const memories = await listTutorMemories(userId);
		return Response.json({
			memories: await Promise.all(memories.map((memory) => publicMemory(userId, memory))),
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
		const denial = await requireMemoryDisclosureAccess(userId);
		if (denial) return denial;
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
