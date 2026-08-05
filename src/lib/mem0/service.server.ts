import MemoryClient, { type Memory } from 'mem0ai';
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { isSuperMemoryEnabled } from '$lib/flags';
import { getMem0UserId, getTutorProfileView } from '$lib/super/profile.server';

let memoryClient: MemoryClient | null | undefined;

const MEMORY_INSTRUCTIONS = [
	'Retain only learning-style preferences, stable study constraints, recurring misconceptions tied to AP courses or units, and explanation strategies that repeatedly helped.',
	'Never retain identity, contact details, school or location, age, health or disability, family or financial information, credentials, unrelated conversation, active-question answers, or full transcripts.'
].join(' ');

export type TutorMemory = {
	id: string;
	text: string;
	createdAt: string | null;
};

/** Opaque per-user token used by the UI instead of exposing Mem0's memory identifier. */
export async function getTutorMemoryPublicId(userId: string, memoryId: string): Promise<string> {
	const mem0UserId = await getMem0UserId(userId);
	return createHmac('sha256', mem0UserId).update(memoryId).digest('base64url');
}

export async function resolveTutorMemoryId(
	userId: string,
	publicId: string
): Promise<string | null> {
	const memories = await listTutorMemories(userId);
	for (const memory of memories) {
		if ((await getTutorMemoryPublicId(userId, memory.id)) === publicId) return memory.id;
	}
	return null;
}

function getMemoryClient(): MemoryClient | null {
	if (memoryClient !== undefined) return memoryClient;
	const apiKey = env.MEM0_API_KEY?.trim();
	memoryClient = apiKey ? new MemoryClient({ apiKey }) : null;
	return memoryClient;
}

export function isTutorMemoryConfigured(): boolean {
	return getMemoryClient() !== null;
}

export async function isTutorMemoryAvailable(): Promise<boolean> {
	return getMemoryClient() !== null && (await isSuperMemoryEnabled());
}

function toTutorMemory(memory: Memory): TutorMemory | null {
	const text = memory.memory ?? memory.data?.memory;
	if (!memory.id || !text?.trim()) return null;
	return {
		id: memory.id,
		text: text.trim(),
		createdAt: memory.createdAt ? new Date(memory.createdAt).toISOString() : null
	};
}

/** A missing or unavailable Mem0 client is intentionally non-fatal for tutoring. */
export async function searchTutorMemories(userId: string, query: string): Promise<TutorMemory[]> {
	const client = getMemoryClient();
	if (!client || !query.trim() || !(await isSuperMemoryEnabled())) return [];
	const profile = await getTutorProfileView(userId);
	if (!profile.memoryEnabled || !profile.memoryDisclosureSeenAt) return [];
	const mem0UserId = await getMem0UserId(userId);
	const result = await client.search(query.slice(0, 1_000), {
		filters: { user_id: mem0UserId },
		topK: 5,
		latestOnly: true
	});
	return result.results
		.map(toTutorMemory)
		.filter((memory): memory is TutorMemory => memory !== null);
}

export async function addTutorMemoryExchange(
	userId: string,
	exchange: { user: string; assistant: string }
): Promise<boolean> {
	const client = getMemoryClient();
	if (!client || !(await isSuperMemoryEnabled())) return false;
	const profile = await getTutorProfileView(userId);
	if (!profile.memoryEnabled || !profile.memoryDisclosureSeenAt) return false;
	const mem0UserId = await getMem0UserId(userId);
	await client.add(
		[
			{ role: 'user', content: exchange.user.slice(0, 2_000) },
			{ role: 'assistant', content: exchange.assistant.slice(0, 2_000) }
		],
		{
			userId: mem0UserId,
			customInstructions: MEMORY_INSTRUCTIONS,
			metadata: { surface: 'tutor' }
		}
	);
	return true;
}

export async function listTutorMemories(userId: string): Promise<TutorMemory[]> {
	const client = getMemoryClient();
	if (!client) return [];
	const mem0UserId = await getMem0UserId(userId);
	const result = await client.getAll({
		filters: { user_id: mem0UserId },
		pageSize: 100,
		latestOnly: true
	});
	return result.results
		.map(toTutorMemory)
		.filter((memory): memory is TutorMemory => memory !== null);
}

export async function deleteTutorMemory(userId: string, memoryId: string): Promise<void> {
	const client = getMemoryClient();
	if (!client) throw new Error('Tutor memory is not configured');
	const memories = await listTutorMemories(userId);
	if (!memories.some((memory) => memory.id === memoryId)) {
		throw new Error('Tutor memory was not found');
	}
	await client.delete(memoryId, { deleteLinked: true });
}

export async function deleteAllTutorMemoriesById(mem0UserId: string): Promise<void> {
	const client = getMemoryClient();
	if (!client) throw new Error('Tutor memory is not configured');
	await client.deleteAll({ userId: mem0UserId });
}

export async function deleteAllTutorMemories(userId: string): Promise<void> {
	await deleteAllTutorMemoriesById(await getMem0UserId(userId));
}
