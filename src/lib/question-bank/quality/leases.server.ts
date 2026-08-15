import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { qualityReviewJobs } from '$lib/server/neon/schema';

const PROCESSING_LEASE_MS = 55_000;
const SUBMISSION_LEASE_MS = 5 * 60_000;

export async function claimReviewProcessingLease(
	jobId: string,
	now = new Date()
): Promise<Date | null> {
	const leaseUntil = new Date(now.getTime() + PROCESSING_LEASE_MS);
	const [claimed] = await getNeonDatabase()
		.update(qualityReviewJobs)
		.set({ processingLeaseUntil: leaseUntil, updatedAt: now })
		.where(
			and(
				eq(qualityReviewJobs.id, jobId),
				inArray(qualityReviewJobs.status, ['preparing', 'in_progress', 'paused']),
				or(
					isNull(qualityReviewJobs.processingLeaseUntil),
					lt(qualityReviewJobs.processingLeaseUntil, now)
				)
			)
		)
		.returning({ id: qualityReviewJobs.id });

	return claimed ? leaseUntil : null;
}

export async function claimReviewSubmissionLease(
	jobId: string,
	now = new Date()
): Promise<Date | null> {
	const leaseUntil = new Date(now.getTime() + SUBMISSION_LEASE_MS);
	const [claimed] = await getNeonDatabase()
		.update(qualityReviewJobs)
		.set({ submissionLeaseUntil: leaseUntil, updatedAt: now })
		.where(
			and(
				eq(qualityReviewJobs.id, jobId),
				inArray(qualityReviewJobs.status, ['preparing', 'in_progress']),
				isNull(qualityReviewJobs.activeBatchId),
				or(
					isNull(qualityReviewJobs.submissionLeaseUntil),
					lt(qualityReviewJobs.submissionLeaseUntil, now)
				)
			)
		)
		.returning({ id: qualityReviewJobs.id });

	return claimed ? leaseUntil : null;
}

export async function releaseReviewProcessingLease(jobId: string, leaseUntil: Date): Promise<void> {
	await getNeonDatabase()
		.update(qualityReviewJobs)
		.set({ processingLeaseUntil: null, updatedAt: new Date() })
		.where(
			and(eq(qualityReviewJobs.id, jobId), eq(qualityReviewJobs.processingLeaseUntil, leaseUntil))
		);
}

export async function releaseReviewSubmissionLease(jobId: string, leaseUntil: Date): Promise<void> {
	await getNeonDatabase()
		.update(qualityReviewJobs)
		.set({ submissionLeaseUntil: null, updatedAt: new Date() })
		.where(
			and(eq(qualityReviewJobs.id, jobId), eq(qualityReviewJobs.submissionLeaseUntil, leaseUntil))
		);
}
