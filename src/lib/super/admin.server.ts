import { Types } from 'mongoose';
import { connectDb } from '$lib/server/db';
import { getEntitlements } from '$lib/super/entitlements.server';
import {
	SuperBillingAccess,
	SuperCleanupJob,
	SuperGrant,
	SuperUsageRollup,
	type ISuperCleanupJob
} from '$lib/super/models.server';
import type { SuperAccessReason } from '$lib/super/types';

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
	kind: ISuperCleanupJob['kind'];
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
		_id: unknown;
		userId: string;
		stripeCustomerId?: string;
		stripeSubscriptionId?: string;
		status: string;
		periodStart?: Date;
		periodEnd?: Date;
		cancelAtPeriodEnd: boolean;
		cancelAt?: Date;
		pastDueSince?: Date;
		superEndedAt?: Date;
	},
	accessReason: SuperAccessReason
): SuperSubscriptionView {
	return {
		id: String(subscription._id),
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
	_id: unknown;
	userId: string;
	kind: ISuperCleanupJob['kind'];
	attempts: number;
	nextAttemptAt: Date;
	lastError?: string;
	createdAt: Date;
	updatedAt: Date;
}): SuperCleanupJobView {
	return {
		id: String(job._id),
		userId: job.userId,
		kind: job.kind,
		attempts: job.attempts,
		nextAttemptAt: job.nextAttemptAt.toISOString(),
		lastError: job.lastError ?? 'Unknown cleanup failure',
		createdAt: job.createdAt.toISOString(),
		updatedAt: job.updatedAt.toISOString()
	};
}

function toGrantView(grant: {
	_id: unknown;
	userId: string;
	startsAt: Date;
	expiresAt: Date;
	reason: string;
	createdBy: string;
	createdAt: Date;
}): SuperGrantView {
	return {
		id: String(grant._id),
		userId: grant.userId,
		startsAt: grant.startsAt.toISOString(),
		expiresAt: grant.expiresAt.toISOString(),
		reason: grant.reason,
		createdBy: grant.createdBy,
		createdAt: grant.createdAt.toISOString()
	};
}

export async function getSuperAdminOverview(now = new Date()): Promise<SuperAdminOverview> {
	await connectDb();
	const [
		activeSubscriptions,
		pastDueSubscriptions,
		subscriptions,
		grants,
		usage,
		usageRollups,
		jobs
	] = await Promise.all([
		SuperBillingAccess.countDocuments({ plan: 'super', status: 'active' }).exec(),
		SuperBillingAccess.countDocuments({ plan: 'super', status: 'past_due' }).exec(),
		SuperBillingAccess.find({ plan: 'super' }).sort({ updatedAt: -1 }).limit(100).lean().exec(),
		SuperGrant.find({
			startsAt: { $lte: now },
			expiresAt: { $gt: now },
			revokedAt: { $exists: false }
		})
			.sort({ expiresAt: 1, createdAt: -1 })
			.limit(100)
			.lean()
			.exec(),
		SuperUsageRollup.aggregate<{ total: number }>([
			{ $match: { month: monthKey(now) } },
			{ $group: { _id: null, total: { $sum: '$personalizedMessages' } } }
		]).exec(),
		SuperUsageRollup.find({ month: monthKey(now) })
			.sort({ personalizedMessages: -1, updatedAt: -1 })
			.limit(100)
			.lean()
			.exec(),
		SuperCleanupJob.find({
			completedAt: { $exists: false },
			lastError: { $exists: true, $nin: [null, ''] }
		})
			.sort({ updatedAt: -1 })
			.limit(100)
			.lean()
			.exec()
	]);

	const accessByUser = new Map(
		await Promise.all(
			[...new Set(subscriptions.map((subscription) => subscription.userId))].map(
				async (userId) => [userId, (await getEntitlements(userId, now)).accessReason] as const
			)
		)
	);

	return {
		activeSubscriptions,
		pastDueSubscriptions,
		activeGrants: await SuperGrant.countDocuments({
			startsAt: { $lte: now },
			expiresAt: { $gt: now },
			revokedAt: { $exists: false }
		}).exec(),
		month: monthKey(now),
		personalizedMessagesThisMonth: usage[0]?.total ?? 0,
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
	await connectDb();
	const grant = await SuperGrant.create(input);
	return toGrantView(grant);
}

export async function revokeSuperGrant(grantId: string, revokedAt = new Date()): Promise<boolean> {
	if (!Types.ObjectId.isValid(grantId)) return false;
	await connectDb();
	const result = await SuperGrant.updateOne(
		{ _id: grantId, revokedAt: { $exists: false } },
		{ $set: { revokedAt } }
	).exec();
	return result.modifiedCount === 1;
}

export async function retrySuperCleanupJob(
	jobId: string,
	nextAttemptAt = new Date()
): Promise<boolean> {
	if (!Types.ObjectId.isValid(jobId)) return false;
	await connectDb();
	const result = await SuperCleanupJob.updateOne(
		{
			_id: jobId,
			completedAt: { $exists: false },
			lastError: { $exists: true, $nin: [null, ''] }
		},
		{ $set: { nextAttemptAt } }
	).exec();
	return result.modifiedCount === 1;
}
