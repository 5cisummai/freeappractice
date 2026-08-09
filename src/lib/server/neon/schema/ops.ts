import {
	boolean,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { authUsers } from './auth';
import { createdAt, updatedAt } from './common';

export const opsSchema = pgSchema('ops');

// Operational state and migration bookkeeping. These rows deliberately do not
// cascade from auth users where a cleanup job must survive account deletion.
export const poolRefillStates = opsSchema.table(
	'pool_refill_states',
	{
		id: text('id').primaryKey(),
		questionType: text('question_type').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		status: text('status').notNull(),
		target: integer('target').notNull(),
		observedCount: integer('observed_count').notNull().default(0),
		requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' }).notNull(),
		leaseOwner: text('lease_owner'),
		leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
		attempts: integer('attempts').notNull().default(0),
		generatedCount: integer('generated_count').notNull().default(0),
		lastError: text('last_error'),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }),
		lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('pool_refill_states_bucket_uq').on(table.questionType, table.apClass, table.unit),
		index('pool_refill_states_claim_idx').on(
			table.status,
			table.nextAttemptAt,
			table.leaseExpiresAt
		)
	]
);

export const poolBucketWriteLocks = opsSchema.table(
	'pool_bucket_write_locks',
	{
		id: text('id').primaryKey(),
		questionType: text('question_type').notNull(),
		apClass: text('ap_class').notNull(),
		unit: text('unit').notNull(),
		leaseOwner: text('lease_owner'),
		leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		uniqueIndex('pool_bucket_write_locks_bucket_uq').on(
			table.questionType,
			table.apClass,
			table.unit
		)
	]
);

export const poolGenerationBudgets = opsSchema.table('pool_generation_budgets', {
	dayKey: text('day_key').primaryKey(),
	generations: integer('generations').notNull().default(0),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

/** Immutable source rollups retained for migration audit; serving uses views. */
export const generationRollupSnapshots = opsSchema.table(
	'generation_rollup_snapshots',
	{
		id: text('id').primaryKey(),
		sourceCollection: text('source_collection').notNull(),
		apClass: text('ap_class'),
		unit: text('unit'),
		count: integer('count').notNull(),
		totalQuestionChars: integer('total_question_chars').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		uniqueIndex('generation_rollup_snapshots_source_uq').on(
			table.sourceCollection,
			table.apClass,
			table.unit
		)
	]
);

export const superCleanupJobs = opsSchema.table(
	'super_cleanup_jobs',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull(),
		mem0UserId: text('mem0_user_id').notNull(),
		kind: text('kind').notNull(),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true, mode: 'date' }).notNull(),
		attempts: integer('attempts').notNull().default(0),
		lastError: text('last_error'),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('super_cleanup_jobs_claim_idx').on(table.nextAttemptAt, table.completedAt),
		index('super_cleanup_jobs_user_kind_idx').on(table.userId, table.kind, table.completedAt)
	]
);

export const migrationRuns = opsSchema.table('migration_runs', {
	id: text('id').primaryKey(),
	phase: text('phase').notNull(),
	status: text('status').notNull(),
	startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
	completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
	options: jsonb('options')
		.$type<Record<string, unknown>>()
		.notNull()
		.default(sql`'{}'::jsonb`),
	error: text('error')
});

export const betterAuthMigrationMap = opsSchema.table(
	'better_auth_migration_map',
	{
		legacyUserId: text('legacy_user_id').primaryKey(),
		betterAuthUserId: text('better_auth_user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'restrict' }),
		email: text('email').notNull(),
		hasCredential: boolean('has_credential').notNull(),
		hasGoogle: boolean('has_google').notNull(),
		migratedAt: timestamp('migrated_at', { withTimezone: true, mode: 'date' }).notNull(),
		status: text('status').notNull()
	},
	(table) => [index('better_auth_migration_map_better_auth_user_idx').on(table.betterAuthUserId)]
);

export const legacyDocuments = opsSchema.table(
	'legacy_documents',
	{
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id').notNull(),
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		document: jsonb('document').$type<Record<string, unknown>>().notNull(),
		archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		primaryKey({ columns: [table.sourceCollection, table.sourceId] }),
		index('legacy_documents_run_idx').on(table.runId)
	]
);

export const migrationTransforms = opsSchema.table(
	'migration_transforms',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id').notNull(),
		fieldPaths: text('field_paths').array().notNull(),
		transformation: text('transformation').notNull(),
		createdAt: createdAt()
	},
	(table) => [index('migration_transforms_run_idx').on(table.runId, table.sourceCollection)]
);

export const schemaMigrations = opsSchema.table('schema_migrations', {
	id: text('id').primaryKey(),
	checksum: text('checksum').notNull(),
	appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

export const migrationLedger = opsSchema.table(
	'migration_ledger',
	{
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id').notNull(),
		targetTable: text('target_table').notNull(),
		targetId: text('target_id').notNull(),
		checksum: text('checksum').notNull(),
		migratedAt: timestamp('migrated_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		primaryKey({ columns: [table.sourceCollection, table.sourceId, table.targetTable] }),
		index('migration_ledger_run_idx').on(table.runId)
	]
);

export const migrationRejects = opsSchema.table(
	'migration_rejects',
	{
		id: text('id').primaryKey(),
		runId: text('run_id')
			.notNull()
			.references(() => migrationRuns.id, { onDelete: 'cascade' }),
		sourceCollection: text('source_collection').notNull(),
		sourceId: text('source_id'),
		reason: text('reason').notNull(),
		document: jsonb('document').$type<Record<string, unknown>>().notNull(),
		createdAt: createdAt()
	},
	(table) => [index('migration_rejects_run_collection_idx').on(table.runId, table.sourceCollection)]
);
