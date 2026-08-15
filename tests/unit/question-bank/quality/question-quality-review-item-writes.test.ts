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
	cancelPendingReviewItems,
	claimQueuedReviewItems,
	failPreparingSubmissionItems,
	markPreparingItemsSubmitted,
	requeueStalePreparingItems
} from '$lib/question-bank/quality/review-item-writes.server';

describe('question quality review item writes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.update.mockReturnValue({ set: mocks.set });
		mocks.set.mockReturnValue({ where: mocks.where });
		mocks.where.mockResolvedValue([]);
	});

	it('moves one preparing submission group to submitted in one update', async () => {
		await markPreparingItemsSubmitted('job-1', 'submission-1', 'batch-1');

		expect(mocks.update).toHaveBeenCalledOnce();
		expect(mocks.set).toHaveBeenCalledWith({
			status: 'submitted',
			batchId: 'batch-1',
			updatedAt: expect.any(Date)
		});
		expect(mocks.where).toHaveBeenCalledOnce();
	});

	it('fails one preparing submission group in one update', async () => {
		await failPreparingSubmissionItems('job-1', 'submission-1', 'Cancelled');

		expect(mocks.set).toHaveBeenCalledWith({
			status: 'failed',
			error: 'Cancelled',
			updatedAt: expect.any(Date)
		});
	});

	it('requeues stale preparing items and restores their attempt count', async () => {
		await requeueStalePreparingItems('job-1', new Date('2026-08-09T20:00:00.000Z'));

		expect(mocks.set).toHaveBeenCalledWith({
			status: 'queued',
			attempts: expect.anything(),
			updatedAt: expect.any(Date)
		});
	});

	it('claims queued item ids and returns only rows won by the guarded update', async () => {
		mocks.where.mockReturnValue({ returning: mocks.returning });
		mocks.returning.mockResolvedValue([{ id: 'item-1', questionId: 'q-1' }]);

		await expect(claimQueuedReviewItems(['item-1', 'item-2'], 'submission-1')).resolves.toEqual([
			{ id: 'item-1', questionId: 'q-1' }
		]);
		expect(mocks.set).toHaveBeenCalledWith({
			status: 'preparing',
			submissionKey: 'submission-1',
			attempts: expect.anything(),
			updatedAt: expect.any(Date)
		});
	});

	it('cancels queued and preparing items together with one set-based update', async () => {
		await cancelPendingReviewItems('job-1', 'Cancelled by administrator');

		expect(mocks.update).toHaveBeenCalledOnce();
		expect(mocks.set).toHaveBeenCalledWith({
			status: 'failed',
			error: 'Cancelled by administrator',
			updatedAt: expect.any(Date)
		});
	});
});
