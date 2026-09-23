import type { PageServerLoad } from './$types';
import {
	getTutorMemoryPublicId,
	isTutorMemoryConfigured,
	listTutorMemories
} from '$lib/mem0/service.server';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.userId!;
	const memoryAvailable = isTutorMemoryConfigured();

	try {
		const memories = await listTutorMemories(userId);
		memories.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

		return {
			memoryAvailable,
			loadError: false,
			memories: await Promise.all(
				memories.map(async ({ id, text, createdAt }) => ({
					id: await getTutorMemoryPublicId(userId, id),
					text,
					createdAt
				}))
			)
		};
	} catch {
		return { memoryAvailable, loadError: true, memories: [] };
	}
};
