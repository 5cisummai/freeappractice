/**
 * Shared Neon migration helpers used by `bun run db:apply`.
 *
 * Extracted so checksum matching and apply order can be unit-tested without
 * opening a database connection.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canAdoptNeonBaseline, NEON_BASELINE_ID } from './neon-baseline';

const statementBreakpoint = /--> statement-breakpoint/g;

export type AppliedChecksumMatch = 'current' | 'historical' | 'mismatch';

export type MigrationStatement = {
	text: string;
	params?: unknown[];
};

export type MigrationExecutor = {
	query: (text: string, params?: unknown[]) => Promise<unknown>;
	transaction: (statements: MigrationStatement[]) => Promise<void>;
};

export type ApplyMigrationsResult = {
	applied: string[];
	skipped: string[];
	historical: string[];
	adopted: string[];
};

/**
 * SHA-256 of applied SQL that was later rewritten in git. Production recorded
 * `0002_super_usage_credits_milli` from commit `476de76a` (ALTER + millicredit
 * reset). That file was restored to DDL-only in `cd4d7e5f`, which made CI
 * refuse every later migration — including AP Art History `0004`.
 *
 * Accepting this checksum is not a rewrite of production history: the extra
 * UPDATE already ran, and `0005` is a no-op so credits are not reset again.
 */
export const HISTORICAL_APPLIED_CHECKSUMS: Readonly<Record<string, readonly string[]>> = {
	'0002_super_usage_credits_milli': [
		'4817b49135c6caec48ea8f7381b64a889ec859b933aa00ec2179bd87e0b73b16'
	],
	'0005_reset_super_usage_credits_milli': [
		'29bc875f3902da37d6cd55f891f0b6fe4c41dec2b6357367ccaeea1dcb733a72'
	]
};

export function checksum(contents: string): string {
	return createHash('sha256').update(contents).digest('hex');
}

export function splitMigrationStatements(contents: string): string[] {
	return contents
		.split(statementBreakpoint)
		.map((statement) => statement.trim())
		.filter(Boolean);
}

export function matchAppliedChecksum(
	id: string,
	stored: string,
	current: string
): AppliedChecksumMatch {
	if (stored === current) return 'current';
	if (HISTORICAL_APPLIED_CHECKSUMS[id]?.includes(stored)) return 'historical';
	return 'mismatch';
}

export async function applyCommittedMigrations(
	sql: MigrationExecutor,
	options: { migrationsDirectory: string; through?: string }
): Promise<ApplyMigrationsResult> {
	const migrationsDirectory = resolve(options.migrationsDirectory);
	const result: ApplyMigrationsResult = {
		applied: [],
		skipped: [],
		historical: [],
		adopted: []
	};

	await sql.query(`
		CREATE TABLE IF NOT EXISTS public._neon_schema_migrations (
			id text PRIMARY KEY,
			checksum text NOT NULL,
			applied_at timestamptz NOT NULL DEFAULT NOW()
		)
	`);

	const allFiles = (await readdir(migrationsDirectory))
		.filter((file) => file.endsWith('.sql'))
		.sort();
	const through = options.through?.trim();
	let files = allFiles;
	if (through) {
		const throughFile = through.endsWith('.sql') ? through : `${through}.sql`;
		const throughIndex = allFiles.indexOf(throughFile);
		if (throughIndex === -1) throw new Error(`Migration cap does not match a SQL file: ${through}`);
		files = allFiles.slice(0, throughIndex + 1);
	}

	for (const file of files) {
		const id = file.replace(/\.sql$/, '');
		const contents = await readFile(join(migrationsDirectory, file), 'utf8');
		const digest = checksum(contents);
		const existing = (await sql.query(
			'SELECT checksum FROM public._neon_schema_migrations WHERE id = $1',
			[id]
		)) as Array<{ checksum: string }>;
		if (existing[0]) {
			const match = matchAppliedChecksum(id, existing[0].checksum, digest);
			switch (match) {
				case 'current':
					result.skipped.push(file);
					continue;
				case 'historical':
					await sql.query('UPDATE public._neon_schema_migrations SET checksum = $2 WHERE id = $1', [
						id,
						digest
					]);
					result.historical.push(file);
					console.log(`Updated recorded checksum for ${file} to match rewritten applied SQL`);
					continue;
				case 'mismatch':
					throw new Error(
						`Applied migration was modified or renamed: ${file} ` +
							`(stored ${existing[0].checksum}, file ${digest}). ` +
							'Do not rewrite applied SQL; add a follow-up migration.'
					);
				default: {
					const exhaustive: never = match;
					throw new Error(`Unhandled checksum match: ${exhaustive}`);
				}
			}
		}

		if (id === NEON_BASELINE_ID) {
			const applied = (await sql.query(
				'SELECT id, checksum FROM public._neon_schema_migrations'
			)) as Array<{ id: string; checksum: string }>;
			if (canAdoptNeonBaseline(applied)) {
				await sql.query(
					'INSERT INTO public._neon_schema_migrations (id, checksum) VALUES ($1, $2)',
					[id, digest]
				);
				result.adopted.push(file);
				console.log(`Adopted ${file}; existing schema and data were preserved`);
				continue;
			}
		}

		const statements: MigrationStatement[] = splitMigrationStatements(contents).map((text) => ({
			text
		}));
		statements.push({
			text: 'INSERT INTO public._neon_schema_migrations (id, checksum) VALUES ($1, $2)',
			params: [id, digest]
		});
		await sql.transaction(statements);
		result.applied.push(file);
		console.log(`Applied ${file}`);
	}

	console.log(
		`Migrations: ${result.applied.length} applied, ${result.skipped.length} already present` +
			(result.historical.length > 0 ? `, ${result.historical.length} historical checksum(s)` : '') +
			(result.adopted.length > 0 ? `, ${result.adopted.length} adopted` : '')
	);
	return result;
}
