import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import {
	deleteAllTutorMemories,
	getTutorMemoryPublicId,
	isTutorMemoryConfigured,
	listTutorMemories
} from '$lib/mem0/service.server';
import { isSuperMemoryEnabled } from '$lib/flags';
import { getSuperFeatureAccess, superFeatureAccessMessage } from '$lib/super/feature-access.server';
import { getTutorProfileView, markMemoryDisclosureSeen } from '$lib/super/profile.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';

async function requireMemoryAccess(userId: string): Promise<Response | null> {
	if (!(await isSuperMemoryEnabled())) {
		return json({ error: 'Tutor memory is temporarily unavailable.' }, { status: 503 });
	}
	const access = await getSuperFeatureAccess(userId, 'memory');
	return access.allowed
		? null
		: json({ error: superFeatureAccessMessage(access, 'Super tutor memory') }, { status: 403 });
}

async function requireMemoryDisclosureAccess(userId: string): Promise<Response | null> {
	if (!(await isSuperMemoryEnabled())) {
		return json({ error: 'Tutor memory is temporarily unavailable.' }, { status: 503 });
	}
	const profile = await getTutorProfileView(userId);
	if (!profile.ageConfirmedAt) {
		return json(
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
		const denial = await requireMemoryAccess(userId);
		if (denial) return denial;
		const profile = await getTutorProfileViewForRequest(event.locals, userId);
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
		const denial = await requireMemoryDisclosureAccess(userId);
		if (denial) return denial;
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
		const denial = await requireMemoryAccess(userId);
		if (denial) return denial;
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
