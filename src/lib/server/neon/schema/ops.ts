import { index, integer, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './common';

export const opsSchema = pgSchema('ops');

// Operational state. These rows deliberately do not cascade from auth users
// where a cleanup job must survive account deletion.
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
