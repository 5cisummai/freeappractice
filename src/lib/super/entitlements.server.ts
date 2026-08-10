import { and, desc, eq, gt, isNotNull, isNull, lte } from 'drizzle-orm';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { getNeonDatabase } from '$lib/server/neon/db';
import { superBillingAccess, superGrants, tutorProfiles } from '$lib/server/neon/schema';
import { lockInsightReports } from '$lib/super/insight-locks.server';
import { markSuperAccessStarted } from '$lib/super/profile.server';
import {
	FREE_ENTITLEMENTS,
	SUPER_PAST_DUE_GRACE_MS,
	type Entitlements,
	type SuperAccessReason
} from '$lib/super/types';

function superEntitlements(reason: Exclude<SuperAccessReason, null>): Entitlements {
	return {
		plan: 'super',
		accessReason: reason,
		personalizedTutor: true,
		coach: true,
		aiInsights: true,
		studyPlans: true
	};
}

export async function getEntitlements(userId: string, now = new Date()): Promise<Entitlements> {
	if (await isSuperFreeBetaEnabled()) {
		const [claimed] = await getNeonDatabase()
			.select({ userId: tutorProfiles.userId })
			.from(tutorProfiles)
			.where(and(eq(tutorProfiles.userId, userId), isNotNull(tutorProfiles.superFreeBetaClaimedAt)))
			.limit(1);
		if (claimed) {
			await markSuperAccessStarted(userId, now);
			return superEntitlements('free_beta');
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
		return superEntitlements('admin_grant');
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
		return superEntitlements('subscription');
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
		return superEntitlements('past_due_grace');
	}
	return FREE_ENTITLEMENTS;
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
