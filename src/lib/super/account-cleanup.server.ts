import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { deleteAllTutorMemoriesById } from '$lib/mem0/service.server';
import { logger } from '$lib/server/logger';
import { getNeonDatabase } from '$lib/server/neon/db';
import { superCleanupJobs } from '$lib/server/neon/schema';
import { deletePostHogUser } from '$lib/server/posthog';
import { purgeKnownRedisControlsForUser } from '$lib/super/ai-controls.server';
import { cancelStripeSubscriptionsForUser } from '$lib/super/billing.server';
import { getMem0UserId } from '$lib/super/profile.server';

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

export async function processAccountDeletionCleanup(userId: string): Promise<void> {
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
	if (!job) return;

	try {
		await deletePostHogUser(userId);
		await deleteAllTutorMemoriesById(job.mem0UserId);
		await db.delete(superCleanupJobs).where(eq(superCleanupJobs.id, job.id));
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
	}
}
