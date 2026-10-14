import { and, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';

import { getNeonDatabase } from '#lib/server/neon/db.js';
import { superBillingAccess, superGrants, tutorProfiles } from '#lib/server/neon/schema.js';
import {
	getPlanAccess,
	markSuperAccessEndedIfNoAccess
} from '#lib/billing/subscriptions.server.js';

import { SUPER_PAST_DUE_GRACE_MS } from '#lib/billing/types.js';

export async function runBillingMaintenance(now = new Date(), batchSize = 50): Promise<number> {
	const db = getNeonDatabase();
	const pastDueGraceCutoff = new Date(now.getTime() - SUPER_PAST_DUE_GRACE_MS);
	const expiredPastDueRecords = await db
		.select({ userId: superBillingAccess.userId, pastDueSince: superBillingAccess.pastDueSince })
		.from(superBillingAccess)
		.where(
			and(
				eq(superBillingAccess.status, 'past_due'),
				lte(superBillingAccess.pastDueSince, pastDueGraceCutoff),
				isNull(superBillingAccess.superEndedAt)
			)
		)
		.limit(Math.max(1, Math.min(batchSize, 100)));
	const pastDueEndByUser = new Map<string, Date>();
	for (const subscription of expiredPastDueRecords) {
		if (!subscription.pastDueSince) continue;
		const accessEndedAt = new Date(subscription.pastDueSince.getTime() + SUPER_PAST_DUE_GRACE_MS);
		const existing = pastDueEndByUser.get(subscription.userId);
		if (!existing || accessEndedAt > existing)
			pastDueEndByUser.set(subscription.userId, accessEndedAt);
	}
	for (const [userId, accessEndedAt] of pastDueEndByUser) {
		const access = await getPlanAccess(userId, now);
		if (access.plan === 'super') continue;
		await db
			.update(tutorProfiles)
			.set({ superEndedAt: accessEndedAt, updatedAt: accessEndedAt })
			.where(and(eq(tutorProfiles.userId, userId), isNull(tutorProfiles.superEndedAt)));
	}

	const betaProfiles = await db
		.select({ userId: tutorProfiles.userId })
		.from(tutorProfiles)
		.where(
			and(
				isNull(tutorProfiles.superEndedAt),
				or(
					isNotNull(tutorProfiles.superAccessStartedAt),
					isNotNull(tutorProfiles.memoryDisclosureSeenAt)
				)
			)
		)
		.limit(Math.max(1, Math.min(batchSize, 100)));
	await Promise.all(
		betaProfiles.map((profile) => markSuperAccessEndedIfNoAccess(profile.userId, now, now))
	);

	const expiredGrantRecords = await db
		.select({
			userId: superGrants.userId,
			startsAt: superGrants.startsAt,
			expiresAt: superGrants.expiresAt,
			revokedAt: superGrants.revokedAt
		})
		.from(superGrants)
		.where(lte(superGrants.expiresAt, now))
		.limit(Math.max(1, Math.min(batchSize, 100)));
	const grantEndByUser = new Map<string, Date>();
	for (const grant of expiredGrantRecords) {
		if (grant.startsAt > now) continue;
		const endedAt =
			grant.revokedAt && grant.revokedAt < grant.expiresAt ? grant.revokedAt : grant.expiresAt;
		const previous = grantEndByUser.get(grant.userId);
		if (!previous || endedAt > previous) grantEndByUser.set(grant.userId, endedAt);
	}
	await Promise.all(
		[...grantEndByUser].map(([userId, endedAt]) =>
			markSuperAccessEndedIfNoAccess(userId, endedAt, now)
		)
	);

	const deleted = await db
		.delete(superGrants)
		.where(lte(superGrants.expiresAt, now))
		.returning({ id: superGrants.id });
	return deleted.length;
}
