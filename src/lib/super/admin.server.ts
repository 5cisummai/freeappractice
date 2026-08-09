import { randomUUID } from 'node:crypto';
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	inArray,
	isNotNull,
	isNull,
	lte,
	ne,
	sql,
	sum
} from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	superBillingAccess,
	superCleanupJobs,
	superGrants,
	superUsageRollups,
	tutorProfiles
} from '$lib/server/neon/schema';
import { getEntitlements, markSuperAccessEndedIfNoAccess } from '$lib/super/entitlements.server';
import { unlockInsightReports } from '$lib/super/insight-locks.server';
import type { SuperAccessReason } from '$lib/super/types';

type CleanupJobKind = 'account_delete' | 'downgrade_purge';

export type SuperGrantView = {
	id: string;
	userId: string;
	startsAt: string;
	expiresAt: string;
	reason: string;
	createdBy: string;
	createdAt: string;
};

export type SuperSubscriptionView = {
	id: string;
	userId: string;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	status: string;
	periodStart: string | null;
	periodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	cancelAt: string | null;
	pastDueSince: string | null;
	superEndedAt: string | null;
	accessReason: SuperAccessReason;
};

export type SuperUsageRollupView = {
	userId: string;
	personalizedMessages: number;
	updatedAt: string;
};

export type SuperCleanupJobView = {
	id: string;
	userId: string;
	kind: CleanupJobKind;
	attempts: number;
	nextAttemptAt: string;
	lastError: string;
	createdAt: string;
	updatedAt: string;
};

export type SuperAdminOverview = {
	activeSubscriptions: number;
	pastDueSubscriptions: number;
	activeGrants: number;
	month: string;
	personalizedMessagesThisMonth: number;
	subscriptions: SuperSubscriptionView[];
	usageRollups: SuperUsageRollupView[];
	failedCleanupJobs: SuperCleanupJobView[];
	grants: SuperGrantView[];
};

function monthKey(now: Date): string {
	return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toIso(value: Date | string | null | undefined): string | null {
	return value ? new Date(value).toISOString() : null;
}

function toSubscriptionView(
	subscription: {
		id: unknown;
		userId: string;
		stripeCustomerId?: string | null;
		stripeSubscriptionId?: string | null;
		status: string;
		periodStart?: Date | null;
		periodEnd?: Date | null;
		cancelAtPeriodEnd: boolean;
		cancelAt?: Date | null;
		pastDueSince?: Date | null;
		superEndedAt?: Date | null;
	},
	accessReason: SuperAccessReason
): SuperSubscriptionView {
	return {
		id: String(subscription.id),
		userId: subscription.userId,
		stripeCustomerId: subscription.stripeCustomerId ?? null,
		stripeSubscriptionId: subscription.stripeSubscriptionId ?? null,
		status: subscription.status,
		periodStart: toIso(subscription.periodStart),
		periodEnd: toIso(subscription.periodEnd),
		cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
		cancelAt: toIso(subscription.cancelAt),
		pastDueSince: toIso(subscription.pastDueSince),
		superEndedAt: toIso(subscription.superEndedAt),
		accessReason
	};
}

function toCleanupJobView(job: {
	id: unknown;
	userId: string;
	kind: string;
	attempts: number;
	nextAttemptAt: Date;
	lastError?: string | null;
	createdAt: Date;
	updatedAt: Date;
}): SuperCleanupJobView {
	return {
		id: String(job.id),
		userId: job.userId,
		kind: job.kind as CleanupJobKind,
		attempts: job.attempts,
		nextAttemptAt: job.nextAttemptAt.toISOString(),
		lastError: job.lastError ?? 'Unknown cleanup failure',
		createdAt: job.createdAt.toISOString(),
		updatedAt: job.updatedAt.toISOString()
	};
}

function toGrantView(grant: {
	id: unknown;
	userId: string;
	startsAt: Date;
	expiresAt: Date;
	reason: string;
	createdBy: string;
	createdAt: Date;
}): SuperGrantView {
	return {
		id: String(grant.id),
		userId: grant.userId,
		startsAt: grant.startsAt.toISOString(),
		expiresAt: grant.expiresAt.toISOString(),
		reason: grant.reason,
		createdBy: grant.createdBy,
		createdAt: grant.createdAt.toISOString()
	};
}

export async function getSuperAdminOverview(now = new Date()): Promise<SuperAdminOverview> {
	const db = getNeonDatabase();
	const month = monthKey(now);
	const [
		subscriptionCounts,
		activeGrantCount,
		subscriptions,
		grants,
		usageTotal,
		usageRollups,
		jobs
	] = await Promise.all([
		db
			.select({ status: superBillingAccess.status, total: count() })
			.from(superBillingAccess)
			.where(
				and(
					eq(superBillingAccess.plan, 'super'),
					inArray(superBillingAccess.status, ['active', 'past_due'])
				)
			)
			.groupBy(superBillingAccess.status),
		db
			.select({ total: count() })
			.from(superGrants)
			.where(
				and(
					lte(superGrants.startsAt, now),
					gt(superGrants.expiresAt, now),
					isNull(superGrants.revokedAt)
				)
			),
		db
			.select()
			.from(superBillingAccess)
			.where(eq(superBillingAccess.plan, 'super'))
			.orderBy(desc(superBillingAccess.updatedAt))
			.limit(100),
		db
			.select()
			.from(superGrants)
			.where(
				and(
					lte(superGrants.startsAt, now),
					gt(superGrants.expiresAt, now),
					isNull(superGrants.revokedAt)
				)
			)
			.orderBy(asc(superGrants.expiresAt), desc(superGrants.createdAt))
			.limit(100),
		db
			.select({
				total: sql<number>`coalesce(${sum(superUsageRollups.personalizedMessages)}, 0)::int`
			})
			.from(superUsageRollups)
			.where(eq(superUsageRollups.month, month)),
		db
			.select()
			.from(superUsageRollups)
			.where(eq(superUsageRollups.month, month))
			.orderBy(desc(superUsageRollups.personalizedMessages), desc(superUsageRollups.updatedAt))
			.limit(100),
		db
			.select()
			.from(superCleanupJobs)
			.where(
				and(
					isNull(superCleanupJobs.completedAt),
					isNotNull(superCleanupJobs.lastError),
					ne(superCleanupJobs.lastError, '')
				)
			)
			.orderBy(desc(superCleanupJobs.updatedAt))
			.limit(100)
	]);

	const accessByUser = new Map(
		await Promise.all(
			[...new Set(subscriptions.map((subscription) => subscription.userId))].map(
				async (userId) => [userId, (await getEntitlements(userId, now)).accessReason] as const
			)
		)
	);

	return {
		activeSubscriptions: Number(
			subscriptionCounts.find((row) => row.status === 'active')?.total ?? 0
		),
		pastDueSubscriptions: Number(
			subscriptionCounts.find((row) => row.status === 'past_due')?.total ?? 0
		),
		activeGrants: Number(activeGrantCount[0]?.total ?? 0),
		month,
		personalizedMessagesThisMonth: Number(usageTotal[0]?.total ?? 0),
		subscriptions: subscriptions.map((subscription) =>
			toSubscriptionView(subscription, accessByUser.get(subscription.userId) ?? null)
		),
		usageRollups: usageRollups.map((rollup) => ({
			userId: rollup.userId,
			personalizedMessages: rollup.personalizedMessages,
			updatedAt: rollup.updatedAt.toISOString()
		})),
		failedCleanupJobs: jobs.map(toCleanupJobView),
		grants: grants.map(toGrantView)
	};
}

export async function createSuperGrant(input: {
	userId: string;
	startsAt: Date;
	expiresAt: Date;
	reason: string;
	createdBy: string;
}): Promise<SuperGrantView> {
	if (input.expiresAt <= input.startsAt) throw new Error('A grant must expire after it starts');
	const [grant] = await getNeonDatabase()
		.insert(superGrants)
		.values({ id: randomUUID(), ...input })
		.returning();
	if (!grant) throw new Error('Super grant insert returned no row');
	if (input.startsAt <= new Date()) {
		await Promise.all([
			getNeonDatabase()
				.update(tutorProfiles)
				.set({ superEndedAt: null, memoryPurgedAt: null, updatedAt: new Date() })
				.where(eq(tutorProfiles.userId, input.userId)),
			unlockInsightReports(input.userId)
		]);
	}
	return toGrantView(grant);
}

export async function revokeSuperGrant(grantId: string, revokedAt = new Date()): Promise<boolean> {
	if (!grantId.trim()) return false;
	const db = getNeonDatabase();
	const [grant] = await db
		.select()
		.from(superGrants)
		.where(and(eq(superGrants.id, grantId), isNull(superGrants.revokedAt)))
		.limit(1);
	if (!grant) return false;
	const result = await db
		.update(superGrants)
		.set({ revokedAt, updatedAt: revokedAt })
		.where(and(eq(superGrants.id, grantId), isNull(superGrants.revokedAt)))
		.returning({ id: superGrants.id });
	if (result.length === 1 && grant.startsAt <= revokedAt && grant.expiresAt > revokedAt) {
		await markSuperAccessEndedIfNoAccess(grant.userId, revokedAt, revokedAt);
	}
	return result.length === 1;
}

export async function retrySuperCleanupJob(
	jobId: string,
	nextAttemptAt = new Date()
): Promise<boolean> {
	const normalizedId = jobId.trim();
	if (
		!/^(?:[a-f\d]{24}|[a-f\d]{8}-[a-f\d]{4}-[4-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})$/i.test(
			normalizedId
		)
	)
		return false;
	const result = await getNeonDatabase()
		.update(superCleanupJobs)
		.set({ nextAttemptAt, updatedAt: new Date() })
		.where(
			and(
				eq(superCleanupJobs.id, normalizedId),
				isNull(superCleanupJobs.completedAt),
				isNotNull(superCleanupJobs.lastError),
				ne(superCleanupJobs.lastError, '')
			)
		)
		.returning({ id: superCleanupJobs.id });
	return result.length === 1;
}
