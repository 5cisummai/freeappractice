import { UserProfile } from '$lib/users/model.server';
import { Referral } from '$lib/referrals/model.server';
import { FrqAttempt } from '$lib/frq/model.server';

/**
 * Deletes app-owned rows for the given user ids (profile, FRQ attempts, referrals).
 * Caller must ensure mongoose is connected. Does not touch auth collections.
 */
export async function deleteAppDataDocuments(userIds: string[]): Promise<void> {
	if (userIds.length === 0) return;

	const userIdFilter = userIds.length === 1 ? userIds[0]! : { $in: userIds };

	await Promise.all([
		UserProfile.deleteMany({ userId: userIdFilter }),
		FrqAttempt.deleteMany({ userId: userIdFilter }),
		Referral.deleteMany({
			$or: [{ referrerUserId: userIdFilter }, { referredUserId: userIdFilter }]
		})
	]);
}
