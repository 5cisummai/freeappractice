import { describe, expect, it } from 'vitest';
import { buildInsightReportData } from '$lib/super/insights.server';
import { buildStudyPlanDraft } from '$lib/super/study-plan.server';

describe('buildStudyPlanDraft', () => {
	it('creates a deterministic seven-day draft with tasks capped at thirty minutes', () => {
		const evidence = Array.from({ length: 20 }, (_, index) => ({
			id: `attempt-${index}`,
			source: 'mcq' as const,
			apClass: 'AP Biology',
			unit: index < 10 ? 'Unit 1' : 'Unit 2',
			scorePercentage: index < 10 ? 40 : 90,
			attemptedAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
		}));
		const report = buildInsightReportData(evidence, {
			now: new Date('2026-07-31T00:00:00.000Z')
		});
		const draft = buildStudyPlanDraft(report, {
			startsOn: '2026-08-03T18:00:00.000Z',
			taskMinutes: 90
		});

		expect(draft.startsOn).toBe('2026-08-03T00:00:00.000Z');
		expect(draft.tasks).toHaveLength(7);
		expect(draft.tasks.every((task) => task.durationMinutes <= 30)).toBe(true);
		expect(draft.tasks[0]).toMatchObject({ unit: 'Unit 1', durationMinutes: 30, status: 'todo' });
		expect(new Set(draft.tasks.map((task) => task.date.slice(0, 10)))).toEqual(
			new Set([
				'2026-08-03',
				'2026-08-04',
				'2026-08-05',
				'2026-08-06',
				'2026-08-07',
				'2026-08-08',
				'2026-08-09'
			])
		);
	});
});
