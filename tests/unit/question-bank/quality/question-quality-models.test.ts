import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	select: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		batch: mocks.batch,
		insert: mocks.insert,
		update: mocks.update,
		select: mocks.select
	})
}));

import {
	createReviewJob,
	getReviewJob,
	updateReviewJob
} from '$lib/question-bank/quality/models.server';

describe('question quality persistence functions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates the review parent and children in one ordered database batch', async () => {
		const parentInsert = { kind: 'parent-insert' };
		const candidateInsert = { kind: 'candidate-insert' };
		const batchInsert = { kind: 'batch-insert' };
		const parentRow = {
			id: 'job-1',
			status: 'preparing',
			filters: {},
			selectedCount: 2,
			model: 'gpt-test',
			rubricVersion: 'test',
			calibrated: false,
			createdBy: 'admin-1',
			createdAt: new Date(),
			updatedAt: new Date()
		};

		mocks.insert
			.mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: () => parentInsert }) })
			.mockReturnValueOnce({ values: vi.fn().mockReturnValue(candidateInsert) })
			.mockReturnValueOnce({ values: vi.fn().mockReturnValue(batchInsert) });
		mocks.batch.mockResolvedValue([[parentRow], [], []]);
		configureHydration([], [], [parentRow]);

		await createReviewJob({
			id: 'job-1',
			status: 'preparing',
			filters: {},
			selectedCount: 2,
			selectedQuestionIds: ['question-1', 'question-2'],
			batches: [
				{
					submissionKey: 'submission-1',
					inputFileId: 'file-1',
					status: 'queued',
					createdAt: new Date()
				}
			],
			model: 'gpt-test',
			rubricVersion: 'test',
			calibrated: false,
			createdBy: 'admin-1'
		});

		expect(mocks.batch).toHaveBeenCalledOnce();
		expect(mocks.batch).toHaveBeenCalledWith([parentInsert, candidateInsert, batchInsert]);
		expect(mocks.insert).toHaveBeenCalledTimes(3);
	});

	it('updates a review job with a direct guarded Drizzle update', async () => {
		const returning = vi.fn().mockResolvedValue([{ id: 'job-1' }]);
		const where = vi.fn().mockReturnValue({ returning });
		const set = vi.fn().mockReturnValue({ where });
		mocks.update.mockReturnValue({ set });

		await expect(
			updateReviewJob('job-1', { status: 'paused' }, { status: 'in_progress' })
		).resolves.toBe(1);
		expect(set).toHaveBeenCalledWith({ status: 'paused', updatedAt: expect.any(Date) });
	});

	it('hydrates a review job from its parent, candidate, and batch rows', async () => {
		const parent = {
			id: 'job-1',
			status: 'preparing',
			filters: {},
			createdAt: new Date(),
			updatedAt: new Date()
		};
		configureHydration(
			[{ questionId: 'question-1', selected: true }],
			[
				{
					submissionKey: 'submission-1',
					inputFileId: 'file-1',
					status: 'queued',
					createdAt: new Date()
				}
			],
			[parent]
		);

		await expect(getReviewJob('job-1')).resolves.toMatchObject({
			id: 'job-1',
			selectedQuestionIds: ['question-1'],
			batches: [{ submissionKey: 'submission-1', inputFileId: 'file-1' }]
		});
	});
});

function configureHydration(
	candidates: Array<Record<string, unknown>>,
	batches: Array<Record<string, unknown>>,
	parentRows?: Array<Record<string, unknown>>
) {
	const query = (rows: Array<Record<string, unknown>>) => ({
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockResolvedValue(rows),
		limit: vi.fn().mockResolvedValue(rows)
	});
	if (parentRows) mocks.select.mockReturnValueOnce(query(parentRows));
	mocks.select.mockReturnValueOnce(query(candidates)).mockReturnValueOnce(query(batches));
}
