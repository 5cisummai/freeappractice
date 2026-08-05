import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import {
	deleteAllTutorMemories,
	getTutorMemoryPublicId,
	isTutorMemoryConfigured,
	listTutorMemories
} from '$lib/mem0/service.server';
import { getTutorProfileView, markMemoryDisclosureSeen } from '$lib/super/profile.server';

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
	async (_event, userId) => {
		const profile = await getTutorProfileView(userId);
		const memories = await listTutorMemories(userId);
		return json({
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
		await markMemoryDisclosureSeen(userId);
		const profile = await getTutorProfileView(userId);
		return json({
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
	async (_event, userId) => {
		if (!isTutorMemoryConfigured()) {
			return json({ error: 'Tutor memory is not configured' }, { status: 503 });
		}

		await deleteAllTutorMemories(userId);
		return json({ deleted: true });
	},
	{
		logLabel: 'Delete all Super tutor memories error',
		errorMessage: 'Failed to delete tutor memories'
	}
);
