/**
 * Applies committed Drizzle SQL files through Neon HTTPS.
 *
 * Drizzle Kit is used to generate and review SQL. This small runner exists so
 * applying that reviewed SQL does not require a pg pool or a WebSocket
 * session. Each migration's statements are sent as a Neon HTTP transaction;
 * the file is recorded only after the transaction succeeds.
 */
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { applyCommittedMigrations, type MigrationExecutor } from './neon-migrations';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl))
	throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');

const sql = neon(databaseUrl);
const executor: MigrationExecutor = {
	query: (text, params) => sql.query(text, params),
	transaction: async (statements) => {
		await sql.transaction(
			statements.map((statement) => sql.query(statement.text, statement.params))
		);
	}
};
const migrationsDirectory = resolve(process.env.DRIZZLE_MIGRATIONS_DIR ?? 'drizzle');

void applyCommittedMigrations(executor, {
	migrationsDirectory,
	through: process.env.DRIZZLE_MIGRATIONS_THROUGH
}).catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
