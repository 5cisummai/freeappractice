import { describe, expect, it } from 'vitest';
import { buildInsightReportData, type InsightScoredAttempt } from '$lib/super/insights.server';

function attempts(
	count: number,
	options: Partial<InsightScoredAttempt> = {}
): InsightScoredAttempt[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `${options.source ?? 'mcq'}-${index}`,
		source: options.source ?? 'mcq',
		apClass: options.apClass ?? 'AP Biology',
		unit: options.unit ?? 'Unit 1',
		scorePercentage: options.scorePercentage ?? 80,
		attemptedAt:
			options.attemptedAt ?? `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
	}));
}

describe('buildInsightReportData', () => {
	it('requires twenty scored attempts and five per source/course/unit claim', () => {
		const report = buildInsightReportData(
			[
				...attempts(5, { source: 'mcq', unit: 'Unit 1' }),
				...attempts(5, { source: 'frq', unit: 'Unit 1' }),
				...attempts(5, { source: 'mcq', unit: 'Unit 2' }),
				...attempts(5, { source: 'frq', unit: 'Unit 2' })
			],
			{ now: new Date('2026-07-31T00:00:00.000Z') }
		);

		expect(report.eligibility).toMatchObject({
			eligible: true,
			totalScoredAttempts: 20,
			mcqScoredAttempts: 10,
			frqScoredAttempts: 10,
			minimumTotalAttempts: 20,
			minimumAttemptsPerClaim: 5
		});
		expect(report.calculation).toMatchObject({
			recentWindowDays: 30,
			recentMinimumAttempts: 5,
			recentWeight: 0.7,
			lifetimeWeight: 0.3
		});
	});

	it('uses 70/30 weighting only when a claim has five recent attempts', () => {
		const report = buildInsightReportData(
			[
				...attempts(5, {
					scorePercentage: 100,
					attemptedAt: '2026-07-20T00:00:00.000Z'
				}),
				...attempts(5, {
					scorePercentage: 0,
					attemptedAt: '2026-06-01T00:00:00.000Z'
				})
			],
			{ now: new Date('2026-07-31T00:00:00.000Z') }
		);
		const metric = report.courses[0]?.units[0]?.metrics.mcq;

		expect(metric).toMatchObject({
			count: 10,
			recentCount: 5,
			lifetimeAveragePercentage: 50,
			recentAveragePercentage: 100,
			weightedAveragePercentage: 85,
			weighting: '70% recent / 30% lifetime'
		});
	});

	it('excludes future attempts from lifetime counts', () => {
		const report = buildInsightReportData(
			attempts(5, { attemptedAt: '2026-08-01T00:00:00.000Z' }),
			{ now: new Date('2026-07-31T00:00:00.000Z') }
		);
		expect(report.courses[0]?.units[0]?.metrics.mcq).toBeUndefined();
	});
});
