import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
	updateSet: vi.fn(),
	updateWhere: vi.fn(),
	updateReturning: vi.fn(),
	delete: vi.fn(),
	deleteWhere: vi.fn(),
	insert: vi.fn(),
	insertValues: vi.fn(),
	insertSelect: vi.fn(),
	insertReturning: vi.fn(),
	planRows: [] as Array<Record<string, unknown>>,
	taskRows: [] as Array<Record<string, unknown>>
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		batch: mocks.batch,
		select: mocks.select,
		update: mocks.update,
		delete: mocks.delete,
		insert: mocks.insert
	})
}));

vi.mock('$lib/flags', () => ({
	isSuperInsightsEnabled: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/super/billing.server', () => ({
	getEntitlements: vi.fn().mockResolvedValue({ studyPlans: true })
}));

vi.mock('$lib/super/profile.server', () => ({
	getTutorProfileView: vi.fn().mockResolvedValue({ ageConfirmedAt: new Date() })
}));

vi.mock('$lib/super/insights.server', () => ({
	getCurrentEligibleInsightReport: vi.fn()
}));

vi.mock('$lib/question-bank/util.server', () => ({
	isDuplicateKeyError: vi.fn().mockReturnValue(false)
}));

import { saveStudyPlan, StudyPlanConflictError } from '$lib/super/study-plan.server';

function selectBuilder() {
	const builder = {
		from: vi.fn(),
		where: vi.fn(),
		limit: vi.fn(),
		orderBy: vi.fn()
	};
	builder.from.mockReturnValue(builder);
	builder.where.mockReturnValue(builder);
	builder.limit.mockResolvedValue(mocks.planRows);
	builder.orderBy.mockResolvedValue(mocks.taskRows);
	return builder;
}

const existingPlan = {
	id: 'plan-1',
	userId: 'user-1',
	startsOn: new Date('2026-08-10T00:00:00.000Z'),
	updatedAt: new Date('2026-08-09T20:00:00.000Z')
};

const existingTask = {
	id: 'task-1',
	planId: 'plan-1',
	apClass: 'AP Biology',
	unit: 'Unit 1',
	mode: 'mcq',
	taskDate: new Date('2026-08-10T00:00:00.000Z'),
	durationMinutes: 25,
	status: 'todo',
	practiceHref: '/app/practice?apClass=AP+Biology&unit=Unit+1'
};

const draft = {
	startsOn: '2026-08-10T12:00:00.000Z',
	tasks: [
		{
			id: 'task-1',
			apClass: 'AP Biology',
			unit: 'Unit 1',
			mode: 'mcq' as const,
			date: '2026-08-10T00:00:00.000Z',
			durationMinutes: 25,
			status: 'todo' as const,
			practiceHref: '/app/practice?apClass=AP+Biology&unit=Unit+1'
		}
	]
};

describe('study-plan persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.planRows = [existingPlan];
		mocks.taskRows = [existingTask];
		mocks.select.mockImplementation(() => selectBuilder());
		mocks.update.mockReturnValue({ set: mocks.updateSet });
		mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
		mocks.updateWhere.mockReturnValue({ returning: mocks.updateReturning });
		mocks.updateReturning.mockReturnValue({ kind: 'parent-update' });
		mocks.delete.mockReturnValue({ where: mocks.deleteWhere });
		mocks.deleteWhere.mockReturnValue({ kind: 'task-delete' });
		mocks.insert.mockReturnValue({
			values: mocks.insertValues,
			select: mocks.insertSelect
		});
		mocks.insertValues.mockReturnValue({ returning: mocks.insertReturning });
		mocks.insertReturning.mockReturnValue({ kind: 'parent-insert' });
		mocks.insertSelect.mockReturnValue({ kind: 'task-insert' });
		mocks.batch.mockResolvedValue([[{ id: 'plan-1' }], [], []]);
	});

	it('composes the parent CAS, task delete, and task insert in one batch', async () => {
		await expect(saveStudyPlan('user-1', draft)).resolves.toMatchObject({
			id: 'plan-1',
			tasks: [{ id: 'task-1', status: 'todo' }]
		});

		expect(mocks.batch).toHaveBeenCalledOnce();
		const [statements] = mocks.batch.mock.calls[0] as [unknown[]];
		expect(statements).toHaveLength(3);
		expect(mocks.update).toHaveBeenCalledOnce();
		expect(mocks.delete).toHaveBeenCalledOnce();
		expect(mocks.insert).toHaveBeenCalledOnce();
		expect(mocks.insertSelect).toHaveBeenCalledOnce();
		expect(mocks.updateSet).toHaveBeenCalledWith({
			startsOn: new Date('2026-08-10T00:00:00.000Z'),
			updatedAt: expect.any(Date)
		});
	});

	it('returns a clear conflict when the parent CAS update is stale', async () => {
		mocks.batch.mockResolvedValueOnce([[], [], []]);

		try {
			await saveStudyPlan('user-1', draft);
			expect.fail('expected a stale study-plan write to conflict');
		} catch (error) {
			expect(error).toBeInstanceOf(StudyPlanConflictError);
			expect(error).toMatchObject({
				name: 'StudyPlanConflictError',
				message: 'Study plan changed while saving; please retry.'
			});
		}
		expect(mocks.batch).toHaveBeenCalledOnce();
	});
});
