import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	applyCommittedMigrations,
	checksum,
	HISTORICAL_APPLIED_CHECKSUMS,
	matchAppliedChecksum,
	splitMigrationStatements,
	type MigrationExecutor,
	type MigrationStatement
} from '../../scripts/neon-migrations';

const PRODUCTION_APPLIED_0002 = `ALTER TABLE "app"."super_usage_rollups" RENAME COLUMN "personalized_messages" TO "credits_milli";--> statement-breakpoint
-- Legacy values were message counts, not millicredits; reset before exposing as credits.
UPDATE "app"."super_usage_rollups" SET "credits_milli" = 0;
`;

const PRODUCTION_APPLIED_0005 = `-- Legacy values were message counts, not millicredits; reset before exposing as credits.
UPDATE "app"."super_usage_rollups" SET "credits_milli" = 0;
`;

function createMemoryExecutor(initialLedger: Record<string, string> = {}) {
	const ledger = new Map(Object.entries(initialLedger));
	const executed: string[] = [];

	const query = async (text: string, params?: unknown[]) => {
		if (/CREATE TABLE IF NOT EXISTS public\._neon_schema_migrations/i.test(text)) return [];
		if (/SELECT checksum FROM public\._neon_schema_migrations WHERE id/i.test(text)) {
			const stored = ledger.get(String(params?.[0]));
			return stored ? [{ checksum: stored }] : [];
		}
		if (/SELECT id, checksum FROM public\._neon_schema_migrations/i.test(text)) {
			return [...ledger.entries()].map(([id, stored]) => ({ id, checksum: stored }));
		}
		if (/INSERT INTO public\._neon_schema_migrations/i.test(text)) {
			ledger.set(String(params?.[0]), String(params?.[1]));
			return [];
		}
		if (/UPDATE public\._neon_schema_migrations SET checksum/i.test(text)) {
			ledger.set(String(params?.[0]), String(params?.[1]));
			return [];
		}
		executed.push(text.trim());
		return [];
	};

	const executor: MigrationExecutor = {
		query,
		transaction: async (statements: MigrationStatement[]) => {
			for (const statement of statements) {
				await query(statement.text, statement.params);
			}
		}
	};

	return { executor, ledger, executed };
}

describe('Neon migration checksum matching', () => {
	it('accepts the production checksum of rewritten 0002', async () => {
		const current = await readFile('drizzle/0002_super_usage_credits_milli.sql', 'utf8');
		expect(checksum(PRODUCTION_APPLIED_0002)).toBe(
			HISTORICAL_APPLIED_CHECKSUMS['0002_super_usage_credits_milli'][0]
		);
		expect(
			matchAppliedChecksum('0002_super_usage_credits_milli', checksum(current), checksum(current))
		).toBe('current');
		expect(
			matchAppliedChecksum(
				'0002_super_usage_credits_milli',
				checksum(PRODUCTION_APPLIED_0002),
				checksum(current)
			)
		).toBe('historical');
		expect(
			matchAppliedChecksum(
				'0002_super_usage_credits_milli',
				'not-a-real-checksum',
				checksum(current)
			)
		).toBe('mismatch');
	});

	it('accepts the production checksum of rewritten 0005', async () => {
		const current = await readFile('drizzle/0005_reset_super_usage_credits_milli.sql', 'utf8');
		expect(checksum(PRODUCTION_APPLIED_0005)).toBe(
			HISTORICAL_APPLIED_CHECKSUMS['0005_reset_super_usage_credits_milli'][0]
		);
		expect(
			matchAppliedChecksum(
				'0005_reset_super_usage_credits_milli',
				checksum(PRODUCTION_APPLIED_0005),
				checksum(current)
			)
		).toBe('historical');
	});

	it('rejects a rewritten applied file that has no historical alias', () => {
		expect(matchAppliedChecksum('0004_zippy_namora', 'old', 'new')).toBe('mismatch');
	});
});

describe('splitMigrationStatements', () => {
	it('splits AP Art History DDL on statement breakpoints', async () => {
		const contents = await readFile('drizzle/0004_zippy_namora.sql', 'utf8');
		const statements = splitMigrationStatements(contents);
		expect(statements[0]).toBe('CREATE SCHEMA "ap_art_history";');
		expect(statements.some((statement) => statement.includes('"ap_art_history"."works"'))).toBe(
			true
		);
		expect(
			statements.some((statement) => statement.includes('"ap_art_history"."api_history"'))
		).toBe(true);
	});
});

describe('applyCommittedMigrations', () => {
	it('unblocks later files when 0002 has the production historical checksum', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'neon-migrations-'));
		const current0002 = await readFile('drizzle/0002_super_usage_credits_milli.sql', 'utf8');
		const sql0004 = await readFile('drizzle/0004_zippy_namora.sql', 'utf8');
		const sql0005 = await readFile('drizzle/0005_reset_super_usage_credits_milli.sql', 'utf8');
		await writeFile(join(directory, '0002_super_usage_credits_milli.sql'), current0002);
		await writeFile(join(directory, '0004_zippy_namora.sql'), sql0004);
		await writeFile(join(directory, '0005_reset_super_usage_credits_milli.sql'), sql0005);

		const { executor, ledger, executed } = createMemoryExecutor({
			'0002_super_usage_credits_milli': checksum(PRODUCTION_APPLIED_0002)
		});

		const first = await applyCommittedMigrations(executor, { migrationsDirectory: directory });
		expect(first.historical).toEqual(['0002_super_usage_credits_milli.sql']);
		expect(first.applied).toEqual([
			'0004_zippy_namora.sql',
			'0005_reset_super_usage_credits_milli.sql'
		]);
		expect(executed.some((sql) => sql.includes('CREATE SCHEMA "ap_art_history"'))).toBe(true);
		expect(executed.some((sql) => sql.includes('"ap_art_history"."works"'))).toBe(true);
		expect(executed.some((sql) => /^\s*UPDATE\s/im.test(sql))).toBe(false);
		expect(executed.some((sql) => sql.includes('SELECT 1'))).toBe(true);
		expect(ledger.get('0002_super_usage_credits_milli')).toBe(checksum(current0002));
		expect(ledger.get('0004_zippy_namora')).toBe(checksum(sql0004));
		expect(ledger.get('0005_reset_super_usage_credits_milli')).toBe(checksum(sql0005));

		executed.length = 0;
		const second = await applyCommittedMigrations(executor, { migrationsDirectory: directory });
		expect(second.applied).toEqual([]);
		expect(second.skipped).toEqual([
			'0002_super_usage_credits_milli.sql',
			'0004_zippy_namora.sql',
			'0005_reset_super_usage_credits_milli.sql'
		]);
		expect(executed).toEqual([]);
	});

	it('still fails when an applied migration was rewritten without an alias', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'neon-migrations-'));
		await writeFile(join(directory, '0003_slippery_prowler.sql'), 'SELECT 1;\n');
		const { executor } = createMemoryExecutor({
			'0003_slippery_prowler': 'old-checksum'
		});
		await expect(
			applyCommittedMigrations(executor, { migrationsDirectory: directory })
		).rejects.toThrow('Applied migration was modified or renamed: 0003_slippery_prowler.sql');
	});
});
