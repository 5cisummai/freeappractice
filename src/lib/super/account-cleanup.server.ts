import { deleteAllTutorMemoriesById } from '$lib/mem0/service.server';
import { logger } from '$lib/server/logger';
import { purgeKnownRedisControlsForUser } from '$lib/super/ai-controls.server';
import { cancelStripeSubscriptionsForUser } from '$lib/super/billing.server';
import { SuperCleanupJob } from '$lib/super/models.server';
import { getMem0UserId } from '$lib/super/profile.server';

const RETRY_DELAY_MS = 60 * 60 * 1000;

/** Runs before Better Auth removes the account; a Stripe failure aborts deletion. */
export async function prepareAccountDeletion(
	userId: string,
	stripeCustomerId?: string
): Promise<void> {
	await cancelStripeSubscriptionsForUser(userId, stripeCustomerId);
	const mem0UserId = await getMem0UserId(userId);
	await SuperCleanupJob.findOneAndUpdate(
		{ userId, kind: 'account_delete', completedAt: { $exists: false } },
		{
			$setOnInsert: {
				userId,
				mem0UserId,
				kind: 'account_delete',
				nextAttemptAt: new Date(),
				attempts: 0
			}
		},
		{ upsert: true, setDefaultsOnInsert: true }
	).exec();
}

export async function processAccountDeletionCleanup(userId: string): Promise<void> {
	await purgeKnownRedisControlsForUser(userId);
	const job = await SuperCleanupJob.findOne({
		userId,
		kind: 'account_delete',
		completedAt: { $exists: false }
	}).exec();
	if (!job) return;

	try {
		await deleteAllTutorMemoriesById(job.mem0UserId);
		await job.deleteOne();
	} catch (error) {
		job.attempts += 1;
		job.nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS);
		job.lastError =
			error instanceof Error ? error.message.slice(0, 500) : 'Unknown Mem0 cleanup failure';
		await job.save();
		logger.error('Account Mem0 cleanup failed', {
			resource: 'account_mem0_cleanup',
			attempts: job.attempts,
			error
		});
	}
}
