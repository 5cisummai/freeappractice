import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { qualityReviewJobItems } from '$lib/server/neon/schema';
import { transitionReviewItemStatus } from './transitions.js';

export type ReviewItemRow = typeof qualityReviewJobItems.$inferSelect;

function now(): Date {
	return new Date();
}

export async function failPreparingSubmissionItems(
	jobId: string,
	submissionKey: string,
	error: string
): Promise<void> {
	await getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({
			status: transitionReviewItemStatus('preparing', 'fail'),
			error,
			updatedAt: now()
		})
		.where(
			and(
				eq(qualityReviewJobItems.jobId, jobId),
				eq(qualityReviewJobItems.status, 'preparing'),
				eq(qualityReviewJobItems.submissionKey, submissionKey)
			)
		);
}

export async function markPreparingItemsSubmitted(
	jobId: string,
	submissionKey: string,
	batchId: string
): Promise<void> {
	await getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({
			status: transitionReviewItemStatus('preparing', 'submit'),
			batchId,
			updatedAt: now()
		})
		.where(
			and(
				eq(qualityReviewJobItems.jobId, jobId),
				eq(qualityReviewJobItems.status, 'preparing'),
				eq(qualityReviewJobItems.submissionKey, submissionKey)
			)
		);
}

export async function requeueStalePreparingItems(jobId: string, staleBefore: Date): Promise<void> {
	await getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({
			status: transitionReviewItemStatus('preparing', 'retry'),
			attempts: sql`${qualityReviewJobItems.attempts} - 1`,
			updatedAt: now()
		})
		.where(
			and(
				eq(qualityReviewJobItems.jobId, jobId),
				eq(qualityReviewJobItems.status, 'preparing'),
				lt(qualityReviewJobItems.updatedAt, staleBefore)
			)
		);
}

export async function claimQueuedReviewItems(
	itemIds: string[],
	submissionKey: string
): Promise<ReviewItemRow[]> {
	if (!itemIds.length) return [];
	return getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({
			status: transitionReviewItemStatus('queued', 'prepare'),
			submissionKey,
			attempts: sql`${qualityReviewJobItems.attempts} + 1`,
			updatedAt: now()
		})
		.where(
			and(inArray(qualityReviewJobItems.id, itemIds), eq(qualityReviewJobItems.status, 'queued'))
		)
		.returning();
}

export async function failSubmittedBatchItems(
	jobId: string,
	batchId: string,
	error: string
): Promise<void> {
	await getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({
			status: transitionReviewItemStatus('submitted', 'fail'),
			error,
			updatedAt: now()
		})
		.where(
			and(
				eq(qualityReviewJobItems.jobId, jobId),
				eq(qualityReviewJobItems.batchId, batchId),
				eq(qualityReviewJobItems.status, 'submitted')
			)
		);
}

export async function cancelPendingReviewItems(jobId: string, error: string): Promise<void> {
	const queued = transitionReviewItemStatus('queued', 'fail');
	const preparing = transitionReviewItemStatus('preparing', 'fail');
	if (queued !== preparing) throw new Error('Pending cancellation transitions disagree');
	await getNeonDatabase()
		.update(qualityReviewJobItems)
		.set({ status: queued, error, updatedAt: now() })
		.where(
			and(
				eq(qualityReviewJobItems.jobId, jobId),
				inArray(qualityReviewJobItems.status, ['queued', 'preparing'])
			)
		);
}
