import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	update: vi.fn(),
	set: vi.fn(),
	where: vi.fn(),
	returning: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ update: mocks.update })
}));

import {
	claimReviewProcessingLease,
	claimReviewSubmissionLease,
	releaseReviewProcessingLease,
	releaseReviewSubmissionLease
} from '$lib/question-bank/quality/leases.server';

describe('question quality review leases', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.update.mockReturnValue({ set: mocks.set });
		mocks.set.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ returning: mocks.returning });
	});

	it('returns a 55-second processing lease only when the conditional update wins', async () => {
		const now = new Date('2026-08-09T20:00:00.000Z');
		mocks.returning.mockResolvedValueOnce([{ id: 'job-1' }]);

		await expect(claimReviewProcessingLease('job-1', now)).resolves.toEqual(
			new Date('2026-08-09T20:00:55.000Z')
		);
		expect(mocks.set).toHaveBeenCalledWith({
			processingLeaseUntil: new Date('2026-08-09T20:00:55.000Z'),
			updatedAt: now
		});

		mocks.returning.mockResolvedValueOnce([]);
		await expect(claimReviewProcessingLease('job-1', now)).resolves.toBeNull();
	});

	it('returns a five-minute submission lease only when the conditional update wins', async () => {
		const now = new Date('2026-08-09T20:00:00.000Z');
		mocks.returning.mockResolvedValueOnce([{ id: 'job-1' }]);

		await expect(claimReviewSubmissionLease('job-1', now)).resolves.toEqual(
			new Date('2026-08-09T20:05:00.000Z')
		);

		mocks.returning.mockResolvedValueOnce([]);
		await expect(claimReviewSubmissionLease('job-1', now)).resolves.toBeNull();
	});

	it('clears processing and submission leases through conditional updates', async () => {
		const leaseUntil = new Date('2026-08-09T20:05:00.000Z');
		mocks.where.mockResolvedValue([]);

		await releaseReviewProcessingLease('job-1', leaseUntil);
		expect(mocks.set).toHaveBeenNthCalledWith(1, {
			processingLeaseUntil: null,
			updatedAt: expect.any(Date)
		});

		await releaseReviewSubmissionLease('job-1', leaseUntil);
		expect(mocks.set).toHaveBeenNthCalledWith(2, {
			submissionLeaseUntil: null,
			updatedAt: expect.any(Date)
		});
	});
});
