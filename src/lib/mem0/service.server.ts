import { Index } from '@upstash/vector';
import { Memory as Mem0Memory } from 'mem0ai/oss';
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { isSuperMemoryEnabled } from '$lib/flags';
import { MAX_TUTOR_MEMORY_EXCHANGE_CHARS } from '$lib/super/agent-request';
import { getMem0UserId, getTutorProfileView } from '$lib/super/profile.server';

let memoryClient: Mem0Memory | null | undefined;
let memoryIndex: Index<Record<string, unknown>> | null | undefined;

const TUTOR_MEMORY_NAMESPACE = 'tutor-memory';
const TUTOR_MEMORY_DIMENSION = 1536;

const MEMORY_INSTRUCTIONS = [
	'Retain only learning-style preferences, stable study constraints, recurring misconceptions tied to AP courses or units, and explanation strategies that repeatedly helped.',
	'Never retain identity, contact details, school or location, age, health or disability, family or financial information, credentials, unrelated conversation, active-question answers, or full transcripts.'
].join(' ');

export type TutorMemory = {
	id: string;
	text: string;
	createdAt: string | null;
};

function getTutorMemoryEnvironment(): 'development' | 'preview' | 'production' {
	return env.VERCEL_ENV === 'production'
		? 'production'
		: env.VERCEL_ENV === 'preview'
			? 'preview'
			: 'development';
}

/** Keep local, preview, and production memories isolated in the shared vector index. */
function getTutorMemoryScope(): string {
	return `tutor:${getTutorMemoryEnvironment()}`;
}

function getTutorMemoryNamespace(): string {
	return `${TUTOR_MEMORY_NAMESPACE}-${getTutorMemoryEnvironment()}`;
}

function getTutorMemoryFilters(userId: string): Record<string, string> {
	return { user_id: userId };
}

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

function getMemoryClient(): Mem0Memory | null {
	if (memoryClient !== undefined) return memoryClient;
	const apiKey = env.OPEN_AI_KEY?.trim();
	const vectorUrl = env.UPSTASH_VECTOR_REST_URL?.trim();
	const vectorToken = env.UPSTASH_VECTOR_REST_TOKEN?.trim();
	const baseURL = env.OPENAI_BASE_URL?.trim() || env.OPENAI_URL?.trim();

	memoryClient =
		apiKey && vectorUrl && vectorToken
			? new Mem0Memory({
					disableHistory: true,
					customInstructions: MEMORY_INSTRUCTIONS,
					embedder: {
						provider: 'openai',
						config: {
							apiKey,
							model: 'text-embedding-3-small',
							embeddingDims: TUTOR_MEMORY_DIMENSION,
							...(baseURL ? { baseURL } : {})
						}
					},
					vectorStore: {
						provider: 'upstash_vector',
						config: {
							collectionName: getTutorMemoryNamespace(),
							dimension: TUTOR_MEMORY_DIMENSION,
							url: vectorUrl,
							token: vectorToken
						}
					},
					llm: {
						provider: 'openai',
						config: {
							apiKey,
							model: 'gpt-5.4-nano',
							...(baseURL ? { baseURL } : {})
						}
					}
				})
			: null;
	return memoryClient;
}

function getMemoryIndex(): Index<Record<string, unknown>> | null {
	if (memoryIndex !== undefined) return memoryIndex;
	const vectorUrl = env.UPSTASH_VECTOR_REST_URL?.trim();
	const vectorToken = env.UPSTASH_VECTOR_REST_TOKEN?.trim();
	memoryIndex =
		vectorUrl && vectorToken
			? new Index<Record<string, unknown>>({
					url: vectorUrl,
					token: vectorToken,
					enableTelemetry: false
				})
			: null;
	return memoryIndex;
}

export function isTutorMemoryConfigured(): boolean {
	return getMemoryClient() !== null;
}

export async function isTutorMemoryAvailable(): Promise<boolean> {
	return getMemoryClient() !== null && (await isSuperMemoryEnabled());
}

function toTutorMemory(memory: {
	id?: unknown;
	memory?: unknown;
	createdAt?: unknown;
	metadata?: Record<string, unknown>;
}): TutorMemory | null {
	const text =
		typeof memory.memory === 'string'
			? memory.memory
			: typeof memory.metadata?.data === 'string'
				? memory.metadata.data
				: null;
	if (typeof memory.id !== 'string' || !text?.trim()) return null;
	const createdAt = memory.createdAt ?? memory.metadata?.createdAt;
	return {
		id: memory.id,
		text: text.trim(),
		createdAt: createdAt ? new Date(createdAt as string | number | Date).toISOString() : null
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
		filters: getTutorMemoryFilters(mem0UserId),
		topK: 5
	});
	return result.results
		.map(toTutorMemory)
		.filter((memory): memory is TutorMemory => memory !== null);
}

export async function addTutorMemoryExchange(
	userId: string,
	exchange: { user: string; assistant: string },
	options?: { surface?: 'tutor' | 'coach' }
): Promise<boolean> {
	const client = getMemoryClient();
	if (!client || !(await isSuperMemoryEnabled())) return false;
	const profile = await getTutorProfileView(userId);
	if (!profile.memoryEnabled || !profile.memoryDisclosureSeenAt) return false;
	const mem0UserId = await getMem0UserId(userId);
	await client.add(
		[
			{ role: 'user', content: exchange.user.slice(0, MAX_TUTOR_MEMORY_EXCHANGE_CHARS) },
			{
				role: 'assistant',
				content: exchange.assistant.slice(0, MAX_TUTOR_MEMORY_EXCHANGE_CHARS)
			}
		],
		{
			userId: mem0UserId,
			filters: getTutorMemoryFilters(mem0UserId),
			metadata: { appId: getTutorMemoryScope(), surface: options?.surface ?? 'tutor' }
		}
	);
	return true;
}

export async function listTutorMemories(userId: string): Promise<TutorMemory[]> {
	const mem0UserId = await getMem0UserId(userId);
	const index = getMemoryIndex();
	if (index) {
		const memories: TutorMemory[] = [];
		const seenCursors = new Set<string>();
		let cursor = '0';
		while (!seenCursors.has(cursor)) {
			seenCursors.add(cursor);
			const page = await index.range(
				{ cursor, limit: 100, includeMetadata: true },
				{ namespace: getTutorMemoryNamespace() }
			);
			for (const vector of page.vectors) {
				if (vector.metadata?.user_id !== mem0UserId) continue;
				const memory = toTutorMemory({
					id: String(vector.id),
					metadata: vector.metadata
				});
				if (memory) memories.push(memory);
			}
			if (!page.nextCursor || page.nextCursor === cursor) break;
			cursor = page.nextCursor;
		}
		return memories;
	}

	const client = getMemoryClient();
	if (!client) return [];
	const result = await client.getAll({
		filters: getTutorMemoryFilters(mem0UserId),
		topK: 1_000
	});
	return result.results
		.map(toTutorMemory)
		.filter((memory): memory is TutorMemory => memory !== null);
}

export async function deleteTutorMemory(userId: string, memoryId: string): Promise<void> {
	const memories = await listTutorMemories(userId);
	if (!memories.some((memory) => memory.id === memoryId)) {
		throw new Error('Tutor memory was not found');
	}
	const index = getMemoryIndex();
	if (index) {
		await index.delete(memoryId, { namespace: getTutorMemoryNamespace() });
		return;
	}
	const client = getMemoryClient();
	if (!client) throw new Error('Tutor memory is not configured');
	await client.delete(memoryId);
}

export async function deleteAllTutorMemoriesById(mem0UserId: string): Promise<void> {
	const index = getMemoryIndex();
	if (index) {
		const memoryIds: string[] = [];
		const seenCursors = new Set<string>();
		let cursor = '0';
		while (!seenCursors.has(cursor)) {
			seenCursors.add(cursor);
			const page = await index.range(
				{ cursor, limit: 100, includeMetadata: true },
				{ namespace: getTutorMemoryNamespace() }
			);
			for (const vector of page.vectors) {
				if (vector.metadata?.user_id === mem0UserId) memoryIds.push(String(vector.id));
			}
			if (!page.nextCursor || page.nextCursor === cursor) break;
			cursor = page.nextCursor;
		}
		for (let offset = 0; offset < memoryIds.length; offset += 100) {
			await index.delete(memoryIds.slice(offset, offset + 100), {
				namespace: getTutorMemoryNamespace()
			});
		}
		return;
	}

	const client = getMemoryClient();
	if (!client) throw new Error('Tutor memory is not configured');
	while (true) {
		const memories = await client.getAll({
			filters: getTutorMemoryFilters(mem0UserId),
			topK: 1_000,
			showExpired: true
		});
		if (!memories.results.length) break;
		for (const memory of memories.results) await client.delete(memory.id);
	}
}

export async function deleteAllTutorMemories(userId: string): Promise<void> {
	await deleteAllTutorMemoriesById(await getMem0UserId(userId));
}
