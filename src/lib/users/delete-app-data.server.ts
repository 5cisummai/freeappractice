import { connectDb } from '$lib/server/db';
import { UserProfile } from '$lib/users/model.server';
import { Referral } from '$lib/referrals/model.server';
import { FrqAttempt } from '$lib/frq/model.server';

/**
 * Deletes app-owned rows for one or more users (profile, FRQ attempts, referrals).
 * Auth collections (sessions/accounts/verifications) are cleaned separately by cron.
 */
export async function deleteAppDataForUsers(userIds: string | string[]): Promise<void> {
	const ids = Array.isArray(userIds) ? userIds : [userIds];
	if (ids.length === 0) return;

	await connectDb();

	const userIdFilter = ids.length === 1 ? ids[0]! : { $in: ids };

	await Promise.all([
		UserProfile.deleteMany({ userId: userIdFilter }),
		FrqAttempt.deleteMany({ userId: userIdFilter }),
		Referral.deleteMany({
			$or: [{ referrerUserId: userIdFilter }, { referredUserId: userIdFilter }]
		})
	]);
}
