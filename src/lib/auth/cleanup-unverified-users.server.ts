import { getMongoDb } from '$lib/server/mongo-native';
import { connectDb } from '$lib/server/db';
import { deleteAppDataForUsers } from '$lib/users/delete-app-data.server';
import { logger } from '$lib/server/logger';
import { unverifiedUserCutoff } from '$lib/auth/cron-auth';

type AuthUserDoc = {
	_id: string;
	emailVerified?: boolean;
	createdAt?: Date;
};

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

	const authUsers = db.collection<AuthUserDoc>('authUsers');
	const staleUsers = await authUsers
		.find({
			emailVerified: { $ne: true },
			createdAt: { $lt: cutoff }
		})
		.project({ _id: 1 })
		.toArray();

	if (staleUsers.length === 0) {
		logger.info('cron cleanup-unverified-users: nothing to delete', {
			cutoff: cutoff.toISOString()
		});
		return { deletedUsers: 0, cutoff: cutoff.toISOString() };
	}

	const deletedUsers = (
		await Promise.all(
			staleUsers.map((user) =>
				authUsers.findOneAndDelete({
					_id: user._id,
					emailVerified: { $ne: true },
					createdAt: { $lt: cutoff }
				})
			)
		)
	).filter((user): user is AuthUserDoc => user !== null);

	if (deletedUsers.length === 0) {
		logger.info('cron cleanup-unverified-users: no eligible users remained', {
			cutoff: cutoff.toISOString()
		});
		return { deletedUsers: 0, cutoff: cutoff.toISOString() };
	}

	const userIds = deletedUsers.map((user) => user._id);

	await Promise.all([
		db.collection('authSessions').deleteMany({ userId: { $in: userIds } }),
		db.collection('authAccounts').deleteMany({ userId: { $in: userIds } }),
		db.collection('authVerifications').deleteMany({ value: { $in: userIds } }),
		deleteAppDataForUsers(userIds)
	]);

	logger.info('cron cleanup-unverified-users: deleted unverified users', {
		deletedUsers: deletedUsers.length,
		cutoff: cutoff.toISOString()
	});

	return {
		deletedUsers: deletedUsers.length,
		cutoff: cutoff.toISOString()
	};
}
