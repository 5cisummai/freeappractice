import { describe, expect, it } from 'vitest';
import { buildStudyPlanPreview, toStudyPlanMobileView } from '#lib/agent/plans/mobile.js';
import type { StudyPlanView } from '#lib/agent/plans/types.js';

const plan: StudyPlanView = {
	id: 'plan-1',
	startsOn: '2026-11-03T00:00:00.000Z',
	updatedAt: '2026-11-03T12:00:00.000Z',
	tasks: [
		{
			id: 'task-done',
			course: 'AP Biology',
			unit: 'Unit 1: Chemistry of Life',
			mode: 'mcq',
			date: '2026-11-03T00:00:00.000Z',
			durationMinutes: 20,
			status: 'done',
			practiceHref: '/app/practice?course=AP+Biology&unit=Unit+1'
		},
		{
			id: 'task-later',
			course: 'AP Chemistry',
			unit: 'Unit 2',
			mode: 'frq',
			date: '2026-11-05T00:00:00.000Z',
			durationMinutes: 25,
			status: 'todo'
		},
		{
			id: 'task-soon',
			course: 'AP Biology',
			unit: 'Unit 2: Cells',
			mode: 'review',
			date: '2026-11-04T00:00:00.000Z',
			durationMinutes: 15,
			status: 'todo'
		},
		{
			id: 'task-far',
			course: 'AP Physics 1',
			unit: 'Unit 1',
			mode: 'mcq',
			date: '2026-11-06T00:00:00.000Z',
			durationMinutes: 20,
			status: 'todo'
		},
		{
			id: 'task-farther',
			course: 'AP Physics 1',
			unit: 'Unit 2',
			mode: 'mcq',
			date: '2026-11-07T00:00:00.000Z',
			durationMinutes: 20,
			status: 'todo'
		}
	]
};

describe('study plan mobile views', () => {
	it('adds native practice destinations without relying on web hrefs', () => {
		const mobile = toStudyPlanMobileView(plan);
		expect(mobile.tasks[0]?.practiceDestination).toEqual({
			kind: 'practice',
			course: 'AP Biology',
			unit: 'Unit 1: Chemistry of Life',
			mode: 'mcq'
		});
		expect(mobile.tasks[0]?.practiceHref).toBe('/app/practice?course=AP+Biology&unit=Unit+1');
	});

	it('previews completed counts and the next three incomplete tasks by date', () => {
		const preview = buildStudyPlanPreview(toStudyPlanMobileView(plan));
		expect(preview).toEqual({
			completedCount: 1,
			totalCount: 5,
			upcomingTasks: [
				expect.objectContaining({ id: 'task-soon' }),
				expect.objectContaining({ id: 'task-later' }),
				expect.objectContaining({ id: 'task-far' })
			]
		});
	});

	it('treats a missing plan as empty preview, not access denied', () => {
		expect(buildStudyPlanPreview(null)).toEqual({
			completedCount: 0,
			totalCount: 0,
			upcomingTasks: []
		});
	});
});
