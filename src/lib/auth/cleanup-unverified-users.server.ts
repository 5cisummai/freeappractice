import { getMongoDb } from '$lib/server/mongo-native';
import { connectDb } from '$lib/server/db';
import { UserProfile } from '$lib/users/model.server';
import { Referral } from '$lib/referrals/model.server';
import { logger } from '$lib/server/logger';
import { unverifiedUserCutoff } from '$lib/auth/cron-auth';

type AuthUserDoc = {
	_id: { toString(): string } | string;
	email?: string;
	emailVerified?: boolean;
	createdAt?: Date;
};

function toUserId(id: AuthUserDoc['_id']): string {
	return typeof id === 'string' ? id : id.toString();
}

/**
 * Deletes Better Auth users whose email is still unverified and who are older
 * than the grace window, plus related auth + app rows.
 */
export async function cleanupUnverifiedUsers(now = new Date()): Promise<{
	deletedUsers: number;
	cutoff: string;
}> {
	const cutoff = unverifiedUserCutoff(now);
	const db = await getMongoDb();
	await connectDb();

	const staleUsers = (await db
		.collection('authUsers')
		.find({
			emailVerified: { $ne: true },
			createdAt: { $lt: cutoff }
		})
		.project({ _id: 1, email: 1 })
		.toArray()) as AuthUserDoc[];

	if (staleUsers.length === 0) {
		logger.info('cron cleanup-unverified-users: nothing to delete', {
			cutoff: cutoff.toISOString()
		});
		return { deletedUsers: 0, cutoff: cutoff.toISOString() };
	}

	const userIds = staleUsers.map((user) => toUserId(user._id));
	const emails = staleUsers
		.map((user) => user.email?.trim())
		.filter((email): email is string => Boolean(email));

	await Promise.all([
		db.collection('authSessions').deleteMany({ userId: { $in: userIds } }),
		db.collection('authAccounts').deleteMany({ userId: { $in: userIds } }),
		emails.length > 0
			? db.collection('authVerifications').deleteMany({ identifier: { $in: emails } })
			: Promise.resolve(),
		UserProfile.deleteMany({ userId: { $in: userIds } }),
		Referral.deleteMany({
			$or: [{ referrerUserId: { $in: userIds } }, { referredUserId: { $in: userIds } }]
		})
	]);

	const deleteResult = await db.collection('authUsers').deleteMany({
		_id: { $in: staleUsers.map((user) => user._id) },
		emailVerified: { $ne: true }
	});

	logger.info('cron cleanup-unverified-users: deleted unverified users', {
		deletedUsers: deleteResult.deletedCount,
		cutoff: cutoff.toISOString()
	});

	return {
		deletedUsers: deleteResult.deletedCount,
		cutoff: cutoff.toISOString()
	};
}
