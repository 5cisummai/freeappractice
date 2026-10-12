import { deleteAllTutorMemoriesById } from '$lib/agent/memory/service.server';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import { studyPlans, superCleanupJobs, superGrants, tutorProfiles } from '$lib/server/neon/schema';
import { getPlanAccess } from '$lib/billing/subscriptions.server';

import { STUDY_PLAN_RETENTION_DAYS } from '$lib/agent/plans/store.server';

import { cleanupCoachImages } from '$lib/agent/attachments/images.server';

const MEMORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

export type SuperMaintenanceSummary = {
	downgradesQueued: number;
	cleanupCompleted: number;
	cleanupRetried: number;
	studyPlansDeleted: number;
};

function memoryRetentionCutoff(now: Date): Date {
	return new Date(now.getTime() - MEMORY_RETENTION_MS);
}

type CleanupJob = typeof superCleanupJobs.$inferSelect;

async function retryCleanupJob(
	db: ReturnType<typeof getNeonDatabase>,
	job: CleanupJob,
	error: unknown
): Promise<number> {
	const attempts = job.attempts + 1;
	const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS);
	const lastError =
		error instanceof Error ? error.message.slice(0, 500) : 'Unknown cleanup failure';
	await db
		.update(superCleanupJobs)
		.set({ attempts, nextAttemptAt, lastError, updatedAt: new Date() })
		.where(eq(superCleanupJobs.id, job.id));
	return attempts;
}

async function processCleanupJob(
	db: ReturnType<typeof getNeonDatabase>,
	job: CleanupJob,
	now: Date
): Promise<'completed' | 'retried'> {
	try {
		if (job.kind === 'downgrade_purge') {
			if ((await getPlanAccess(job.userId, now)).plan === 'super') {
				// A newly created grant can arrive after this job was queued. Removing this disposable
				// job lets maintenance create a fresh one if access later ends without a restore.
				await db.delete(superCleanupJobs).where(eq(superCleanupJobs.id, job.id));
				return 'completed';
			}
			const [profile] = await db
				.select({
					superEndedAt: tutorProfiles.superEndedAt,
					memoryPurgedAt: tutorProfiles.memoryPurgedAt
				})
				.from(tutorProfiles)
				.where(eq(tutorProfiles.userId, job.userId))
				.limit(1);
			if (
				!profile?.superEndedAt ||
				profile.superEndedAt > memoryRetentionCutoff(now) ||
				profile.memoryPurgedAt
			) {
				// The student re-subscribed before the retention period elapsed.
				await db.delete(superCleanupJobs).where(eq(superCleanupJobs.id, job.id));
				return 'completed';
			}
		}

		await deleteAllTutorMemoriesById(job.mem0UserId);
		if (job.kind === 'downgrade_purge') {
			await db.delete(studyPlans).where(eq(studyPlans.userId, job.userId));
			await db
				.update(tutorProfiles)
				.set({ memoryPurgedAt: now, updatedAt: now })
				.where(eq(tutorProfiles.userId, job.userId));
		}
		await db.delete(superCleanupJobs).where(eq(superCleanupJobs.id, job.id));
		return 'completed';
	} catch (error) {
		const attempts = await retryCleanupJob(db, job, error);
		logger.error('Super memory cleanup failed', {
			kind: job.kind,
			attempts,
			error
		});
		return 'retried';
	}
}

/**
 * Daily, idempotent maintenance. Durable user data stays in Neon/Mem0; Redis is intentionally
 * not involved here because jobs must survive restarts and downtime.
 */
export async function runAgentRetention(
	now = new Date(),
	batchSize = DEFAULT_BATCH_SIZE
): Promise<SuperMaintenanceSummary> {
	const db = getNeonDatabase();
	await cleanupCoachImages(now);

	const cutoff = memoryRetentionCutoff(now);
	const studyPlanCutoff = new Date(now.getTime() - STUDY_PLAN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
	const expiredProfiles = await db
		.select({ userId: tutorProfiles.userId, mem0UserId: tutorProfiles.mem0UserId })
		.from(tutorProfiles)
		.where(and(lte(tutorProfiles.superEndedAt, cutoff), isNull(tutorProfiles.memoryPurgedAt)));
	const activeGrants = expiredProfiles.length
		? await db
				.select({ userId: superGrants.userId })
				.from(superGrants)
				.where(
					and(
						inArray(
							superGrants.userId,
							expiredProfiles.map((profile) => profile.userId)
						),
						lte(superGrants.startsAt, now),
						gt(superGrants.expiresAt, now),
						isNull(superGrants.revokedAt)
					)
				)
		: [];
	const activeGrantUsers = new Set(activeGrants.map((grant) => grant.userId));
	const profilesToPurge = expiredProfiles.filter(
		(profile) => !activeGrantUsers.has(profile.userId)
	);

	await Promise.all(
		profilesToPurge.map(async (profile) => {
			const [existing] = await db
				.select({ id: superCleanupJobs.id })
				.from(superCleanupJobs)
				.where(
					and(
						eq(superCleanupJobs.userId, profile.userId),
						eq(superCleanupJobs.kind, 'downgrade_purge'),
						isNull(superCleanupJobs.completedAt)
					)
				)
				.limit(1);
			if (!existing) {
				await db.insert(superCleanupJobs).values({
					id: randomUUID(),
					userId: profile.userId,
					mem0UserId: profile.mem0UserId,
					kind: 'downgrade_purge',
					nextAttemptAt: now,
					attempts: 0
				});
			}
		})
	);

	const expiredStudyPlans = await db
		.delete(studyPlans)
		.where(lte(studyPlans.updatedAt, studyPlanCutoff))
		.returning({ id: studyPlans.id });

	const jobs = await db
		.select()
		.from(superCleanupJobs)
		.where(
			and(
				eq(superCleanupJobs.kind, 'downgrade_purge'),
				isNull(superCleanupJobs.completedAt),
				lte(superCleanupJobs.nextAttemptAt, now)
			)
		)
		.orderBy(asc(superCleanupJobs.nextAttemptAt), asc(superCleanupJobs.id))
		.limit(Math.max(1, Math.min(batchSize, 100)));

	const results = await Promise.all(jobs.map((job) => processCleanupJob(db, job, now)));
	return {
		downgradesQueued: profilesToPurge.length,
		cleanupCompleted: results.filter((result) => result === 'completed').length,
		cleanupRetried: results.filter((result) => result === 'retried').length,
		studyPlansDeleted: expiredStudyPlans.length
	};
}
