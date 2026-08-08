/**
 * Applies committed Drizzle SQL files through Neon HTTPS.
 *
 * Drizzle Kit is used to generate and review SQL. This small runner exists so
 * applying that reviewed SQL does not require a pg pool or a WebSocket
 * session. Each migration's statements are sent as a Neon HTTP transaction;
 * the file is recorded only after the transaction succeeds.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl))
	throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');

const sql = neon(databaseUrl);
const migrationsDirectory = resolve(process.env.DRIZZLE_MIGRATIONS_DIR ?? 'drizzle');
const statementBreakpoint = /--> statement-breakpoint/g;

function checksum(contents: string): string {
	return createHash('sha256').update(contents).digest('hex');
}

async function main(): Promise<void> {
	await sql.query(`
		CREATE TABLE IF NOT EXISTS public._neon_schema_migrations (
			id text PRIMARY KEY,
			checksum text NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT NOW()
		)
	`);

	const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();

	for (const file of files) {
		const id = file.replace(/\.sql$/, '');
		const contents = await readFile(join(migrationsDirectory, file), 'utf8');
		const digest = checksum(contents);
		const existing = (await sql.query(
			'SELECT checksum FROM public._neon_schema_migrations WHERE id = $1',
			[id]
		)) as Array<{ checksum: string }>;
		if (existing[0]) {
			if (existing[0].checksum !== digest)
				throw new Error(`Applied migration was modified: ${file}`);
			continue;
		}

		const statements = contents
			.split(statementBreakpoint)
			.map((statement) => statement.trim())
			.filter(Boolean)
			.map((statement) => sql.query(statement));
		if (statements.length) await sql.transaction(statements);
		await sql.query('INSERT INTO public._neon_schema_migrations (id, checksum) VALUES ($1, $2)', [
			id,
			digest
		]);
	}
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
