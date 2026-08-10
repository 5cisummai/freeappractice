import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import * as schema from '$lib/server/neon/schema';

export type NeonDatabase = NeonHttpDatabase<typeof schema>;
export type NeonDatabaseInitObserver = (elapsedMs: number) => void;

type NeonGlobal = typeof globalThis & {
	__freeApPracticeNeon?: NeonDatabase;
};

/**
 * Return the shared Neon HTTP database client.
 *
 * This deliberately uses neon-http. Every call is a stateless HTTPS request,
 * which is compatible with Vercel functions and does not create a pg pool or
 * a WebSocket session. Callers must therefore express mutations as one SQL
 * statement or as independent statements submitted with db.batch().
 *
 * Neon HTTP does not establish a persistent database connection here; the
 * network request and SQL execution happen when a query is awaited. The
 * optional observer therefore measures only client initialization, while
 * callers should measure the awaited query separately.
 */
export function getNeonDatabase(onInit?: NeonDatabaseInitObserver): NeonDatabase {
	const globalNeon = globalThis as NeonGlobal;
	if (globalNeon.__freeApPracticeNeon) {
		onInit?.(0);
		return globalNeon.__freeApPracticeNeon;
	}

	const url =
		env.DATABASE_URL?.trim() ||
		(building
			? 'postgresql://build:placeholder@build-placeholder.neon.tech/neondb?sslmode=require'
			: undefined);
	if (!url) {
		throw new Error('DATABASE_URL is required for the Neon database');
	}

	if (!/^postgres(?:ql)?:\/\//i.test(url)) {
		throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');
	}

	const startedAt = Date.now();
	const sql = neon(url);
	const database = drizzle({ client: sql, schema });
	globalNeon.__freeApPracticeNeon = database;
	onInit?.(Date.now() - startedAt);
	return database;
}
