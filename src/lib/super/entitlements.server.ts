import { connectDb } from '$lib/server/db';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { SuperBillingAccess, SuperGrant } from '$lib/super/models.server';
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
	if (await isSuperFreeBetaEnabled()) return superEntitlements('free_beta');

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

	if (grant) return superEntitlements('admin_grant');
	if (
		billing.some(
			(subscription) =>
				subscription.status === 'active' &&
				!subscription.superEndedAt &&
				subscription.periodEnd &&
				new Date(subscription.periodEnd) > now
		)
	) {
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
		return superEntitlements('past_due_grace');
	}
	return FREE_ENTITLEMENTS;
}
