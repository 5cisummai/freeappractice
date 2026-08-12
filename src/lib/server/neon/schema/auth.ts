import {
	bigint,
	boolean,
	index,
	integer,
	pgSchema,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createdAt, updatedAt } from './common';

export const authSchema = pgSchema('auth');

// Better Auth tables. The logical keys below intentionally match the current
// modelName values in src/lib/auth/server.ts so the migration preserves auth
// behavior and tokens without an adapter-side rename.
export const authUsers = authSchema.table(
	'users',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		emailVerified: boolean('email_verified').notNull().default(false),
		role: text('role'),
		banned: boolean('banned').notNull().default(false),
		banReason: text('ban_reason'),
		banExpires: timestamp('ban_expires', { withTimezone: true, mode: 'date' }),
		image: text('image'),
		stripeCustomerId: text('stripe_customer_id'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [uniqueIndex('auth_users_email_uq').on(table.email)]
);

export const authSessions = authSchema.table(
	'sessions',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		token: text('token').notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		impersonatedBy: text('impersonated_by'),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' })
	},
	(table) => [
		uniqueIndex('auth_sessions_token_uq').on(table.token),
		index('auth_sessions_user_id_idx').on(table.userId),
		index('auth_sessions_expires_at_idx').on(table.expiresAt)
	]
);

export const authAccounts = authSchema.table(
	'accounts',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', {
			withTimezone: true,
			mode: 'date'
		}),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
			withTimezone: true,
			mode: 'date'
		}),
		scope: text('scope'),
		password: text('password'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('auth_accounts_user_id_idx').on(table.userId),
		uniqueIndex('auth_accounts_provider_account_uq').on(table.providerId, table.accountId)
	]
);

export const authVerifications = authSchema.table(
	'verifications',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [index('auth_verifications_identifier_idx').on(table.identifier)]
);

export const authSubscriptions = authSchema.table(
	'subscriptions',
	{
		id: text('id').primaryKey(),
		plan: text('plan').notNull(),
		referenceId: text('reference_id').notNull(),
		stripeCustomerId: text('stripe_customer_id'),
		stripeSubscriptionId: text('stripe_subscription_id'),
		status: text('status').notNull().default('incomplete'),
		periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }),
		periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }),
		trialStart: timestamp('trial_start', { withTimezone: true, mode: 'date' }),
		trialEnd: timestamp('trial_end', { withTimezone: true, mode: 'date' }),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
		cancelAt: timestamp('cancel_at', { withTimezone: true, mode: 'date' }),
		canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),
		endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
		seats: integer('seats'),
		billingInterval: text('billing_interval'),
		stripeScheduleId: text('stripe_schedule_id'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		index('auth_subscriptions_reference_id_idx').on(table.referenceId),
		uniqueIndex('auth_subscriptions_stripe_subscription_uq').on(table.stripeSubscriptionId),
		index('auth_subscriptions_stripe_customer_idx').on(table.stripeCustomerId)
	]
);

export const authRateLimits = authSchema.table(
	'rate_limits',
	{
		id: text('id').primaryKey(),
		key: text('key').notNull(),
		count: integer('count').notNull(),
		lastRequest: bigint('last_request', { mode: 'number' }).notNull()
	},
	(table) => [uniqueIndex('auth_rate_limits_key_uq').on(table.key)]
);

// Relation keys must match Better Auth adapter modelNames (see auth/server.ts).
// Required when experimental.joins is enabled so session lookups can join user.
export const authUsersRelations = relations(authUsers, ({ many }) => ({
	authSessions: many(authSessions),
	authAccounts: many(authAccounts)
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
	authUsers: one(authUsers, {
		fields: [authSessions.userId],
		references: [authUsers.id]
	})
}));

export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
	authUsers: one(authUsers, {
		fields: [authAccounts.userId],
		references: [authUsers.id]
	})
}));

// User-owned application data. Arrays and JSONB are limited to values that
// are genuinely document-shaped; facts that are queried or joined are rows.
