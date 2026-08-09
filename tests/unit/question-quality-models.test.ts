import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	select: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		batch: mocks.batch,
		insert: mocks.insert,
		update: mocks.update,
		delete: mocks.delete,
		select: mocks.select
	})
}));

import {
	QuestionFeedback,
	QuestionQuality,
	QuestionQualityReviewJob,
	QuestionQualityReviewJobItem
} from '$lib/question-quality/models.server';

function hasUniqueIndex(
	indexes: Array<[Record<string, unknown>, { unique?: boolean }]>,
	fields: string[]
) {
	return indexes.some(
		([keys, options]) =>
			options.unique === true &&
			fields.every((field) => Object.prototype.hasOwnProperty.call(keys, field))
	);
}

describe('question quality persistence invariants', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('allows only one active quality record per canonical S3 question', () => {
		expect(hasUniqueIndex(QuestionQuality.schema.indexes(), ['questionId'])).toBe(true);
	});

	it('allows only one claimed job item per canonical S3 question', () => {
		expect(hasUniqueIndex(QuestionQualityReviewJobItem.schema.indexes(), ['questionId'])).toBe(
			true
		);
	});

	it('deduplicates the same feedback type from the same student', () => {
		expect(
			hasUniqueIndex(QuestionFeedback.schema.indexes(), ['questionId', 'userId', 'type'])
		).toBe(true);
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
		configureHydration([], []);

		await QuestionQualityReviewJob.create({
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

	it('persists the parent and replacement children in one ordered database batch', async () => {
		const parentUpdate = { kind: 'parent-update' };
		const deleteCandidates = { kind: 'delete-candidates' };
		const candidateInsert = { kind: 'candidate-insert' };
		const deleteBatches = { kind: 'delete-batches' };
		const batchInsert = { kind: 'batch-insert' };
		mocks.update.mockReturnValue({
			set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(parentUpdate) })
		});
		mocks.delete
			.mockReturnValueOnce({ where: vi.fn().mockReturnValue(deleteCandidates) })
			.mockReturnValueOnce({ where: vi.fn().mockReturnValue(deleteBatches) });
		mocks.insert
			.mockReturnValueOnce({ values: vi.fn().mockReturnValue(candidateInsert) })
			.mockReturnValueOnce({ values: vi.fn().mockReturnValue(batchInsert) });
		mocks.batch.mockResolvedValue([]);
		configureHydration(
			[],
			[],
			[
				{
					id: 'job-1',
					status: 'preparing',
					filters: {},
					createdAt: new Date(),
					updatedAt: new Date()
				}
			]
		);

		const document = await QuestionQualityReviewJob.findById('job-1').exec();
		expect(document).not.toBeNull();
		document!.selectedQuestionIds = ['question-1'];
		document!.batches = [
			{
				submissionKey: 'submission-1',
				inputFileId: 'file-1',
				status: 'queued',
				createdAt: new Date()
			}
		];
		await document!.save();

		expect(mocks.batch).toHaveBeenCalledOnce();
		expect(mocks.batch).toHaveBeenCalledWith([
			parentUpdate,
			deleteCandidates,
			candidateInsert,
			deleteBatches,
			batchInsert
		]);
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
