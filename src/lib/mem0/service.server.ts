import { neon } from '@neondatabase/serverless';
import { Memory as Mem0Memory } from 'mem0ai/oss';
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { isSuperMemoryEnabled } from '$lib/flags';
import { MAX_TUTOR_MEMORY_EXCHANGE_CHARS } from '$lib/super/agent-request';
import { getMem0UserId, getTutorProfileView } from '$lib/super/profile.server';

let memoryClient: Mem0Memory | null | undefined;
const TUTOR_MEMORY_DIMENSION = 1536;

const MEMORY_INSTRUCTIONS = [
	"Retain only learning-style preferences, stable study constraints, recurring misconceptions tied to learning, and explanation strategies that repeatedly helped, as well as facts that provide useful context about the student's abilities..",
	'Never retain identity, contact details, school or location, age, health or disability, family or financial information, credentials, unrelated conversation, active-question answers, or full transcripts.',
	'Be a bit more broad and accepting for what counts as something to be retained, because often, seemingly unrelated or vague information may still be useful.'
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

/** Keep local, preview, and production memories isolated in Neon. */
function getTutorMemoryScope(): string {
	return `tutor:${getTutorMemoryEnvironment()}`;
}

function getTutorMemoryTable(): string {
	return `tutor_memory_${getTutorMemoryEnvironment()}`;
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
	const databaseUrl = env.DATABASE_URL?.trim();
	const baseURL = env.OPENAI_BASE_URL?.trim() || env.OPENAI_URL?.trim();

	memoryClient =
		apiKey && databaseUrl
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
						provider: 'pgvector',
						config: {
							collectionName: getTutorMemoryTable(),
							dimension: TUTOR_MEMORY_DIMENSION,
							embeddingModelDims: TUTOR_MEMORY_DIMENSION,
							connectionString: databaseUrl
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

function getMemorySql() {
	const databaseUrl = env.DATABASE_URL?.trim();
	return databaseUrl ? neon(databaseUrl) : null;
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
	const sql = getMemorySql();
	if (!sql) return [];
	const rows = (await sql.query(
		`SELECT id, payload FROM ${getTutorMemoryTable()} WHERE payload->>'user_id' = $1 ORDER BY payload->>'createdAt' DESC`,
		[mem0UserId]
	)) as Array<{ id: string; payload: Record<string, unknown> }>;
	return rows
		.map((row) => toTutorMemory({ id: row.id, metadata: row.payload }))
		.filter((memory): memory is TutorMemory => memory !== null);
}

export async function deleteTutorMemory(userId: string, memoryId: string): Promise<void> {
	const memories = await listTutorMemories(userId);
	if (!memories.some((memory) => memory.id === memoryId)) {
		throw new Error('Tutor memory was not found');
	}
	const sql = getMemorySql();
	if (!sql) throw new Error('Tutor memory is not configured');
	await sql.query(
		`DELETE FROM ${getTutorMemoryTable()} WHERE id = $1 AND payload->>'user_id' = $2`,
		[memoryId, await getMem0UserId(userId)]
	);
}

export async function deleteAllTutorMemoriesById(mem0UserId: string): Promise<void> {
	const sql = getMemorySql();
	if (!sql) throw new Error('Tutor memory is not configured');
	const table = getTutorMemoryTable();
	await sql.transaction([
		sql.query(`DELETE FROM ${table}_entities WHERE payload->>'user_id' = $1`, [mem0UserId]),
		sql.query(`DELETE FROM ${table} WHERE payload->>'user_id' = $1`, [mem0UserId])
	]);
}

export async function deleteAllTutorMemories(userId: string): Promise<void> {
	await deleteAllTutorMemoriesById(await getMem0UserId(userId));
}
