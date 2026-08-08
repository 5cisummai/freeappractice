import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import * as schema from '$lib/server/neon/schema';

export type NeonDatabase = NeonHttpDatabase<typeof schema>;

type NeonGlobal = typeof globalThis & {
	__freeApPracticeNeon?: NeonDatabase;
};

/**
 * The application database seam.
 *
 * This deliberately uses neon-http. Every call is a stateless HTTPS request,
 * which is compatible with Vercel functions and does not create a pg pool or
 * a WebSocket session. Callers must therefore express mutations as one SQL
 * statement or as independent statements submitted with db.batch().
 */
export function getNeonDatabase(): NeonDatabase {
	const globalNeon = globalThis as NeonGlobal;
	if (globalNeon.__freeApPracticeNeon) return globalNeon.__freeApPracticeNeon;

	const url = env.DATABASE_URL?.trim() ||
		(building ? 'postgresql://build:placeholder@build-placeholder.neon.tech/neondb?sslmode=require' : undefined);
	if (!url) {
		throw new Error('DATABASE_URL is required for the Neon database');
	}

	if (!/^postgres(?:ql)?:\/\//i.test(url)) {
		throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');
	}

	const sql = neon(url);
	const database = drizzle({ client: sql, schema });
	globalNeon.__freeApPracticeNeon = database;
	return database;
}

/**
 * Exposes the underlying tagged HTTP client for migration scripts and a small
 * number of SQL statements that are clearer than a Drizzle expression.
 */
export function getNeonSql() {
	const url = env.DATABASE_URL?.trim() ||
		(building ? 'postgresql://build:placeholder@build-placeholder.neon.tech/neondb?sslmode=require' : undefined);
	if (!url) throw new Error('DATABASE_URL is required for the Neon database');
	if (!/^postgres(?:ql)?:\/\//i.test(url)) {
		throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');
	}
	return neon(url);
}
