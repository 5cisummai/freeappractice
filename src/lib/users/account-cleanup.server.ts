import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { deleteAllTutorMemoriesById } from '#lib/agent/memory/service.server.js';
import { logger } from '#lib/server/logger.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { superCleanupJobs } from '#lib/server/neon/schema.js';
import { deletePostHogUser } from '#lib/server/posthog.js';
import { purgeKnownRedisControlsForUser } from '#lib/agent/usage/controls.server.js';
import { cancelStripeSubscriptionsForUser } from '#lib/billing/subscriptions.server.js';
import { getMem0UserId } from '#lib/agent/personalization/profile.server.js';
import { cleanupCoachImages } from '#lib/agent/attachments/images.server.js';

const RETRY_DELAY_MS = 60 * 60 * 1000;

/** Runs before Better Auth removes the account; a Stripe failure aborts deletion. */
export async function prepareAccountDeletion(
	userId: string,
	stripeCustomerId?: string
): Promise<void> {
	await cancelStripeSubscriptionsForUser(userId, stripeCustomerId);
	const mem0UserId = await getMem0UserId(userId);
	const db = getNeonDatabase();
	const [existing] = await db
		.select({ id: superCleanupJobs.id })
		.from(superCleanupJobs)
		.where(
			and(
				eq(superCleanupJobs.userId, userId),
				eq(superCleanupJobs.kind, 'account_delete'),
				isNull(superCleanupJobs.completedAt)
			)
		)
		.limit(1);
	if (!existing) {
		await db.insert(superCleanupJobs).values({
			id: randomUUID(),
			userId,
			mem0UserId,
			kind: 'account_delete',
			nextAttemptAt: new Date(),
			attempts: 0
		});
	}
}

export async function processAccountDeletionCleanup(
	userId: string
): Promise<'completed' | 'retried'> {
	await cleanupCoachImages(new Date(), userId);
	await purgeKnownRedisControlsForUser(userId);
	const db = getNeonDatabase();
	const [job] = await db
		.select()
		.from(superCleanupJobs)
		.where(
			and(
				eq(superCleanupJobs.userId, userId),
				eq(superCleanupJobs.kind, 'account_delete'),
				isNull(superCleanupJobs.completedAt)
			)
		)
		.limit(1);
	if (!job) return 'completed';

	try {
		await deletePostHogUser(userId);
		await deleteAllTutorMemoriesById(job.mem0UserId);
		await db.delete(superCleanupJobs).where(eq(superCleanupJobs.id, job.id));
		return 'completed';
	} catch (error) {
		const attempts = job.attempts + 1;
		const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS);
		const lastError =
			error instanceof Error ? error.message.slice(0, 500) : 'Unknown account cleanup failure';
		await db
			.update(superCleanupJobs)
			.set({ attempts, nextAttemptAt, lastError, updatedAt: new Date() })
			.where(eq(superCleanupJobs.id, job.id));
		logger.error('Account deletion cleanup failed', {
			resource: 'account_deletion_cleanup',
			attempts,
			error
		});
		return 'retried';
	}
}

export async function runPendingAccountCleanup(now = new Date(), batchSize = 50) {
	const jobs = await getNeonDatabase()
		.select({ userId: superCleanupJobs.userId })
		.from(superCleanupJobs)
		.where(
			and(
				eq(superCleanupJobs.kind, 'account_delete'),
				isNull(superCleanupJobs.completedAt),
				lte(superCleanupJobs.nextAttemptAt, now)
			)
		)
		.orderBy(asc(superCleanupJobs.nextAttemptAt), asc(superCleanupJobs.id))
		.limit(Math.max(1, Math.min(batchSize, 100)));
	const results = await Promise.all(jobs.map((job) => processAccountDeletionCleanup(job.userId)));
	return {
		cleanupCompleted: results.filter((result) => result === 'completed').length,
		cleanupRetried: results.filter((result) => result === 'retried').length
	};
}
