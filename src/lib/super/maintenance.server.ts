import { deleteAllTutorMemoriesById } from '$lib/mem0/service.server';
import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import {
	InsightReport,
	SuperCleanupJob,
	SuperGrant,
	TutorProfile,
	type ISuperCleanupJob
} from '$lib/super/models.server';

const MEMORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

export type SuperMaintenanceSummary = {
	downgradesQueued: number;
	reportsDeleted: number;
	expiredGrantsRemoved: number;
	cleanupCompleted: number;
	cleanupRetried: number;
};

function memoryRetentionCutoff(now: Date): Date {
	return new Date(now.getTime() - MEMORY_RETENTION_MS);
}

async function completeCleanupJob(job: ISuperCleanupJob): Promise<void> {
	job.completedAt = new Date();
	job.lastError = undefined;
	await job.save();
}

async function retryCleanupJob(job: ISuperCleanupJob, error: unknown): Promise<void> {
	job.attempts += 1;
	job.nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS);
	job.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Unknown cleanup failure';
	await job.save();
}

async function processCleanupJob(
	job: ISuperCleanupJob,
	now: Date
): Promise<'completed' | 'retried'> {
	try {
		if (job.kind === 'downgrade_purge') {
			const profile = await TutorProfile.findOne({ userId: job.userId })
				.select({ superEndedAt: 1 })
				.lean()
				.exec();
			if (!profile?.superEndedAt || profile.superEndedAt > memoryRetentionCutoff(now)) {
				// The student re-subscribed before the retention period elapsed.
				await completeCleanupJob(job);
				return 'completed';
			}
		}

		await deleteAllTutorMemoriesById(job.mem0UserId);
		await completeCleanupJob(job);
		return 'completed';
	} catch (error) {
		await retryCleanupJob(job, error);
		logger.error('Super memory cleanup failed', {
			userId: job.userId,
			kind: job.kind,
			attempts: job.attempts,
			error
		});
		return 'retried';
	}
}

/**
 * Daily, idempotent maintenance. Durable user data stays in Mongo/Mem0; Redis is intentionally
 * not involved here because jobs must survive restarts and downtime.
 */
export async function runSuperMaintenance(
	now = new Date(),
	batchSize = DEFAULT_BATCH_SIZE
): Promise<SuperMaintenanceSummary> {
	await connectDb();
	const cutoff = memoryRetentionCutoff(now);
	const expiredProfiles = await TutorProfile.find({ superEndedAt: { $lte: cutoff } })
		.select({ userId: 1, mem0UserId: 1 })
		.lean()
		.exec();
	const activeGrants = expiredProfiles.length
		? await SuperGrant.find({
				userId: { $in: expiredProfiles.map((profile) => profile.userId) },
				startsAt: { $lte: now },
				expiresAt: { $gt: now },
				revokedAt: { $exists: false }
			})
				.select({ userId: 1 })
				.lean()
				.exec()
		: [];
	const activeGrantUsers = new Set(activeGrants.map((grant) => grant.userId));
	const profilesToPurge = expiredProfiles.filter(
		(profile) => !activeGrantUsers.has(profile.userId)
	);

	await Promise.all(
		profilesToPurge.map((profile) =>
			SuperCleanupJob.findOneAndUpdate(
				{ userId: profile.userId, kind: 'downgrade_purge', completedAt: { $exists: false } },
				{
					$setOnInsert: {
						userId: profile.userId,
						mem0UserId: profile.mem0UserId,
						kind: 'downgrade_purge',
						nextAttemptAt: now,
						attempts: 0
					}
				},
				{ upsert: true, new: true, setDefaultsOnInsert: true }
			).exec()
		)
	);

	const [reportDeletion, expiredGrants] = await Promise.all([
		profilesToPurge.length
			? InsightReport.deleteMany({
					userId: { $in: profilesToPurge.map((profile) => profile.userId) }
				}).exec()
			: Promise.resolve({ deletedCount: 0 }),
		SuperGrant.deleteMany({ expiresAt: { $lte: now } }).exec()
	]);

	const jobs = await SuperCleanupJob.find({
		completedAt: { $exists: false },
		nextAttemptAt: { $lte: now }
	})
		.sort({ nextAttemptAt: 1, _id: 1 })
		.limit(Math.max(1, Math.min(batchSize, 100)))
		.exec();

	const results = await Promise.all(jobs.map((job) => processCleanupJob(job, now)));
	return {
		downgradesQueued: profilesToPurge.length,
		reportsDeleted: reportDeletion.deletedCount,
		expiredGrantsRemoved: expiredGrants.deletedCount,
		cleanupCompleted: results.filter((result) => result === 'completed').length,
		cleanupRetried: results.filter((result) => result === 'retried').length
	};
}
