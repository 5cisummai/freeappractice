import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	set: vi.fn(),
	where: vi.fn(),
	returning: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		update: () => ({ set: mocks.set })
	})
}));
vi.mock('$lib/flags', () => ({ isSuperInsightsEnabled: vi.fn() }));

import {
	attachInsightReportPdf,
	buildInsightReportData,
	type InsightScoredAttempt
} from '$lib/super/insights.server';

describe('insight PDF persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.set.mockReturnValue({ where: mocks.where });
		mocks.where.mockReturnValue({ returning: mocks.returning });
	});

	it('updates the JSON report column together with PDF metadata', async () => {
		const generatedAt = new Date('2026-08-01T00:00:00.000Z');
		const attempts: InsightScoredAttempt[] = Array.from({ length: 20 }, (_, index) => ({
			source: 'mcq',
			apClass: 'AP Biology',
			unit: 'Unit 1',
			scorePercentage: 80,
			attemptedAt: new Date(Date.UTC(2026, 6, index + 1))
		}));
		const report = buildInsightReportData(attempts, {
			now: generatedAt,
			narrative: 'A concise narrative.'
		});
		mocks.returning.mockResolvedValueOnce([
			{
				_id: 'report-1',
				userId: 'student-1',
				report,
				evidenceAttemptCount: 20,
				generatedAt,
				manual: false,
				feedback: null,
				feedbackReason: null,
				lockedAt: null,
				createdAt: generatedAt,
				updatedAt: generatedAt
			}
		]);

		const view = await attachInsightReportPdf(
			'student-1',
			'report-1',
			new Uint8Array([1, 2, 3]),
			'A concise narrative.'
		);

		expect(mocks.set).toHaveBeenCalledWith(
			expect.objectContaining({
				report: expect.anything(),
				pdfData: expect.any(Buffer),
				pdfGenerationVersion: 1
			})
		);
		expect(view?.report.narrative).toBe('A concise narrative.');
		expect(view?.pdfAvailable).toBe(true);
	});
});
