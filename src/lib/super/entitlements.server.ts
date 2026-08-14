import { and, desc, eq, gt, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { getNeonDatabase } from '$lib/server/neon/db';
import { superBillingAccess, superGrants, tutorProfiles } from '$lib/server/neon/schema';
import { lockInsightReports } from '$lib/super/insight-locks.server';
import { markSuperAccessStarted } from '$lib/super/profile.server';
import {
	FREE_PLAN_ACCESS,
	SUPER_PAST_DUE_GRACE_MS,
	type Entitlements,
	type PlanAccess,
	type SuperAccessReason,
	hasPaidCapability
} from '$lib/super/types';

function superPlanAccess(reason: Exclude<SuperAccessReason, null>): PlanAccess {
	return {
		plan: 'super',
		accessReason: reason
	};
}

export async function getPlanAccess(userId: string, now = new Date()): Promise<PlanAccess> {
	if (await isSuperFreeBetaEnabled()) {
		const [claimed] = await getNeonDatabase()
			.select({ userId: tutorProfiles.userId })
			.from(tutorProfiles)
			.where(and(eq(tutorProfiles.userId, userId), isNotNull(tutorProfiles.superFreeBetaClaimedAt)))
			.limit(1);
		if (claimed) {
			await markSuperAccessStarted(userId, now);
			return superPlanAccess('free_beta');
		}
	}

	const db = getNeonDatabase();
	const [billing, grants] = await Promise.all([
		db
			.select()
			.from(superBillingAccess)
			.where(and(eq(superBillingAccess.userId, userId), eq(superBillingAccess.plan, 'super')))
			.orderBy(desc(superBillingAccess.updatedAt)),
		db
			.select()
			.from(superGrants)
			.where(
				and(
					eq(superGrants.userId, userId),
					lte(superGrants.startsAt, now),
					gt(superGrants.expiresAt, now),
					isNull(superGrants.revokedAt)
				)
			)
			.limit(1)
	]);
	const grant = grants[0];

	if (grant) {
		await markSuperAccessStarted(userId, now);
		return superPlanAccess('admin_grant');
	}
	if (
		billing.some(
			(subscription) =>
				subscription.status === 'active' &&
				!subscription.superEndedAt &&
				!subscription.billingIssue &&
				subscription.periodEnd &&
				new Date(subscription.periodEnd) > now
		)
	) {
		await markSuperAccessStarted(userId, now);
		return superPlanAccess('subscription');
	}
	if (
		billing.some(
			(subscription) =>
				subscription.status === 'past_due' &&
				!subscription.superEndedAt &&
				subscription.pastDueSince &&
				now.getTime() - new Date(subscription.pastDueSince).getTime() < SUPER_PAST_DUE_GRACE_MS
		)
	) {
		await markSuperAccessStarted(userId, now);
		return superPlanAccess('past_due_grace');
	}
	return FREE_PLAN_ACCESS;
}

/**
 * @deprecated New request handlers should use getPlanAccessForRequest and
 * hasPaidCapability. This adapter keeps existing page/maintenance consumers
 * source-compatible while they migrate to the smaller PlanAccess shape.
 */
export async function getEntitlements(userId: string, now = new Date()): Promise<Entitlements> {
	const access = await getPlanAccess(userId, now);
	return {
		...access,
		personalizedTutor: hasPaidCapability(access, 'personalizedTutor'),
		coach: hasPaidCapability(access, 'coach'),
		aiInsights: hasPaidCapability(access, 'aiInsights'),
		studyPlans: hasPaidCapability(access, 'studyPlans'),
		memory: hasPaidCapability(access, 'memory')
	};
}

export type AdminUserSuperAccess = {
	plan: 'free' | 'super';
	accessReason: SuperAccessReason;
	hasAdminGrant: boolean;
};

export async function getAdminUserSuperAccess(
	userIds: string[],
	now = new Date()
): Promise<Map<string, AdminUserSuperAccess>> {
	const access = new Map<string, AdminUserSuperAccess>();
	for (const userId of userIds) {
		access.set(userId, { plan: 'free', accessReason: null, hasAdminGrant: false });
	}
	if (userIds.length === 0) return access;

	const db = getNeonDatabase();
	const freeBetaEnabled = await isSuperFreeBetaEnabled();
	const [claimed, grants, billing] = await Promise.all([
		freeBetaEnabled
			? db
					.select({ userId: tutorProfiles.userId })
					.from(tutorProfiles)
					.where(
						and(
							inArray(tutorProfiles.userId, userIds),
							isNotNull(tutorProfiles.superFreeBetaClaimedAt)
						)
					)
			: Promise.resolve([] as { userId: string }[]),
		db
			.select({ userId: superGrants.userId })
			.from(superGrants)
			.where(
				and(
					inArray(superGrants.userId, userIds),
					lte(superGrants.startsAt, now),
					gt(superGrants.expiresAt, now),
					isNull(superGrants.revokedAt)
				)
			),
		db
			.select()
			.from(superBillingAccess)
			.where(and(inArray(superBillingAccess.userId, userIds), eq(superBillingAccess.plan, 'super')))
	]);

	const claimedUsers = new Set(claimed.map((row) => row.userId));
	const grantedUsers = new Set(grants.map((row) => row.userId));
	const billingByUser = new Map<string, typeof billing>();
	for (const subscription of billing) {
		const rows = billingByUser.get(subscription.userId) ?? [];
		rows.push(subscription);
		billingByUser.set(subscription.userId, rows);
	}

	for (const userId of userIds) {
		const hasAdminGrant = grantedUsers.has(userId);
		let accessReason: SuperAccessReason = null;
		if (claimedUsers.has(userId)) accessReason = 'free_beta';
		else if (hasAdminGrant) accessReason = 'admin_grant';
		else {
			const subscriptions = billingByUser.get(userId) ?? [];
			if (
				subscriptions.some(
					(subscription) =>
						subscription.status === 'active' &&
						!subscription.superEndedAt &&
						!subscription.billingIssue &&
						subscription.periodEnd &&
						new Date(subscription.periodEnd) > now
				)
			) {
				accessReason = 'subscription';
			} else if (
				subscriptions.some(
					(subscription) =>
						subscription.status === 'past_due' &&
						!subscription.superEndedAt &&
						subscription.pastDueSince &&
						now.getTime() - new Date(subscription.pastDueSince).getTime() < SUPER_PAST_DUE_GRACE_MS
				)
			) {
				accessReason = 'past_due_grace';
			}
		}
		access.set(userId, {
			plan: accessReason ? 'super' : 'free',
			accessReason,
			hasAdminGrant
		});
	}

	return access;
}

/** End Super retention only after every current access source has ended. */
export async function markSuperAccessEndedIfNoAccess(
	userId: string,
	endedAt: Date,
	now = endedAt
): Promise<boolean> {
	const access = await getEntitlements(userId, now);
	if (access.plan === 'super') return false;
	await Promise.all([
		getNeonDatabase()
			.update(tutorProfiles)
			.set({ superEndedAt: endedAt, updatedAt: endedAt })
			.where(and(eq(tutorProfiles.userId, userId), isNull(tutorProfiles.superEndedAt))),
		lockInsightReports(userId, endedAt)
	]);
	return true;
}
