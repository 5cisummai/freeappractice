import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	from: vi.fn(),
	innerJoin: vi.fn(),
	where: vi.fn(),
	orderBy: vi.fn(),
	execute: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		select: mocks.select,
		execute: mocks.execute
	})
}));

import { activateReviewJob } from '$lib/question-bank/quality/job-activation.server';
import { isCalibrationSample } from '$lib/question-bank/quality/rules';

function setupPreviewRows(rows: Array<{ questionId: string; rubricVersion: string }>) {
	mocks.select.mockReturnValue({ from: mocks.from });
	mocks.from.mockReturnValue({ innerJoin: mocks.innerJoin });
	mocks.innerJoin.mockReturnValue({ where: mocks.where });
	mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
	mocks.orderBy.mockResolvedValue(rows);
}

function findQuestion(rubricVersion: string, calibration: boolean): string {
	for (let index = 0; index < 10_000; index += 1) {
		const questionId = `question-${index}`;
		if (isCalibrationSample(questionId, rubricVersion) === calibration) return questionId;
	}
	throw new Error(`Unable to find a ${calibration ? 'calibration' : 'non-calibration'} sample`);
}

function staticSql(statement: { queryChunks: unknown[] }): string {
	return statement.queryChunks
		.filter(
			(chunk): chunk is { value: string[] } =>
				typeof chunk === 'object' &&
				chunk !== null &&
				'value' in chunk &&
				Array.isArray((chunk as { value?: unknown }).value)
		)
		.map((chunk) => chunk.value.join(''))
		.join('');
}

describe('activateReviewJob', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('precomputes blind samples and executes one guarded atomic activation', async () => {
		const rubricVersion = 'ap-quality-v2';
		const calibrationQuestion = findQuestion(rubricVersion, true);
		const normalQuestion = findQuestion(rubricVersion, false);
		setupPreviewRows([
			{ questionId: calibrationQuestion, rubricVersion },
			{ questionId: normalQuestion, rubricVersion }
		]);
		mocks.execute.mockResolvedValue({ rows: [{ id: 'job-1' }] });

		await expect(activateReviewJob('preview-1', 'admin-1')).resolves.toEqual({ jobId: 'job-1' });

		expect(mocks.execute).toHaveBeenCalledOnce();
		const statement = mocks.execute.mock.calls[0][0] as { queryChunks: unknown[] };
		const query = staticSql(statement);
		expect(query).toContain('WITH eligible_preview AS');
		expect(query).toContain('selected_candidates AS MATERIALIZED');
		expect(query).toContain('ON CONFLICT (question_id) DO UPDATE');
		expect(query).toContain("status = 'preparing'");
		expect(query).toContain('DELETE FROM');
		expect(statement.queryChunks).toContain(
			JSON.stringify({ [calibrationQuestion]: true, [normalQuestion]: false })
		);
	});

	it('returns null when the guarded preview update returns no job', async () => {
		setupPreviewRows([]);
		mocks.execute.mockResolvedValue({ rows: [] });

		await expect(activateReviewJob('preview-1', 'admin-1')).resolves.toBeNull();
		expect(mocks.execute).toHaveBeenCalledOnce();
	});

	it('preserves database errors from the preview lookup', async () => {
		mocks.select.mockReturnValue({ from: mocks.from });
		mocks.from.mockReturnValue({ innerJoin: mocks.innerJoin });
		mocks.innerJoin.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
		const error = new Error('database unavailable');
		mocks.orderBy.mockRejectedValue(error);

		await expect(activateReviewJob('preview-1', 'admin-1')).rejects.toBe(error);
		expect(mocks.execute).not.toHaveBeenCalled();
	});
});
