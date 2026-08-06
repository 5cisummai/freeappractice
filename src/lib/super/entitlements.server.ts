import { connectDb } from '$lib/server/db';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { markSuperAccessStarted } from '$lib/super/profile.server';
import {
	InsightReport,
	SuperBillingAccess,
	SuperGrant,
	TutorProfile
} from '$lib/super/models.server';
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
		await markSuperAccessStarted(userId, now);
		return superEntitlements('free_beta');
	}

	await connectDb();
	const [billing, grant] = await Promise.all([
		SuperBillingAccess.find({ userId, plan: 'super' }).sort({ updatedAt: -1 }).lean().exec(),
		SuperGrant.findOne({
			userId,
			startsAt: { $lte: now },
			expiresAt: { $gt: now },
			revokedAt: { $exists: false }
		})
			.lean()
			.exec()
	]);

	if (grant) {
		await markSuperAccessStarted(userId, now);
		return superEntitlements('admin_grant');
	}
	if (
		billing.some(
			(subscription) =>
				subscription.status === 'active' &&
				!subscription.superEndedAt &&
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
	await connectDb();
	await Promise.all([
		TutorProfile.updateOne(
			{ userId, superEndedAt: { $exists: false } },
			{ $set: { superEndedAt: endedAt } }
		).exec(),
		InsightReport.updateMany(
			{ userId, lockedAt: { $exists: false } },
			{ $set: { lockedAt: endedAt } }
		).exec()
	]);
	return true;
}
