import { deleteAllTutorMemoriesById } from '$lib/mem0/service.server';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	studyPlanAudits,
	studyPlans,
	superBillingAccess,
	superCleanupJobs,
	superGrants,
	tutorProfiles
} from '$lib/server/neon/schema';
import { getPlanAccess, markSuperAccessEndedIfNoAccess } from '$lib/super/billing.server';
import { deletePostHogUser } from '$lib/server/posthog';
import { STUDY_PLAN_RETENTION_DAYS } from '$lib/super/study-plan.server';
import { SUPER_PAST_DUE_GRACE_MS } from '$lib/super/types';

const MEMORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

export type SuperMaintenanceSummary = {
	downgradesQueued: number;
	expiredGrantsRemoved: number;
	cleanupCompleted: number;
	cleanupRetried: number;
	studyPlansDeleted: number;
	studyPlanAuditsDeleted: number;
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

		if (job.kind === 'account_delete') await deletePostHogUser(job.userId);
		await deleteAllTutorMemoriesById(job.mem0UserId);
		if (job.kind === 'downgrade_purge') {
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
export async function runSuperMaintenance(
	now = new Date(),
	batchSize = DEFAULT_BATCH_SIZE
): Promise<SuperMaintenanceSummary> {
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

	const [expiredGrants, expiredStudyPlans, expiredStudyPlanAudits] = await Promise.all([
		db
			.delete(superGrants)
			.where(lte(superGrants.expiresAt, now))
			.returning({ id: superGrants.id }),
		db
			.delete(studyPlans)
			.where(lte(studyPlans.updatedAt, studyPlanCutoff))
			.returning({ id: studyPlans.id }),
		db
			.delete(studyPlanAudits)
			.where(lte(studyPlanAudits.createdAt, studyPlanCutoff))
			.returning({ id: studyPlanAudits.id })
	]);

	const jobs = await db
		.select()
		.from(superCleanupJobs)
		.where(and(isNull(superCleanupJobs.completedAt), lte(superCleanupJobs.nextAttemptAt, now)))
		.orderBy(asc(superCleanupJobs.nextAttemptAt), asc(superCleanupJobs.id))
		.limit(Math.max(1, Math.min(batchSize, 100)));

	const results = await Promise.all(jobs.map((job) => processCleanupJob(db, job, now)));
	return {
		downgradesQueued: profilesToPurge.length,
		expiredGrantsRemoved: expiredGrants.length,
		cleanupCompleted: results.filter((result) => result === 'completed').length,
		cleanupRetried: results.filter((result) => result === 'retried').length,
		studyPlansDeleted: expiredStudyPlans.length,
		studyPlanAuditsDeleted: expiredStudyPlanAudits.length
	};
}
