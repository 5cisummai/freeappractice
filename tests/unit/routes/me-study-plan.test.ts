import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	authorizeFeatureRequest: vi.fn(),
	getCurrentStudyPlan: vi.fn(),
	completeStudyTask: vi.fn()
}));

vi.mock('#lib/auth/route-helpers.server.js', () => ({
	withAuthedHandler:
		(handler: (event: unknown, userId: string) => unknown) =>
		(event: { locals: { userId: string } }) =>
			handler(event, event.locals.userId)
}));
vi.mock('#lib/agent/access.server.js', () => ({
	authorizeFeatureRequest: mocks.authorizeFeatureRequest
}));
vi.mock('#lib/agent/plans/store.server.js', async () => {
	const actual = await vi.importActual<typeof import('#lib/agent/plans/store.server.js')>(
		'#lib/agent/plans/store.server.js'
	);
	return {
		...actual,
		getCurrentStudyPlan: mocks.getCurrentStudyPlan,
		completeStudyTask: mocks.completeStudyTask
	};
});

import { GET } from '../../../src/routes/api/me/study-plan/+server';
import { POST as completeTask } from '../../../src/routes/api/me/study-plan/tasks/[taskId]/complete/+server';

describe('study plan API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns access denied separately from an empty entitled plan', async () => {
		mocks.authorizeFeatureRequest.mockResolvedValueOnce({
			allowed: false,
			status: 403,
			code: 'subscription_required',
			message: 'Super subscription required'
		});
		const denied = await GET({
			locals: { userId: 'user-1' }
		} as Parameters<typeof GET>[0]);
		expect(denied.status).toBe(403);
		expect(await denied.json()).toMatchObject({
			canView: false,
			access: { code: 'subscription_required' },
			plan: null,
			preview: null
		});

		mocks.authorizeFeatureRequest.mockResolvedValueOnce({
			allowed: true,
			userId: 'user-1',
			planAccess: {},
			profile: {}
		});
		mocks.getCurrentStudyPlan.mockResolvedValueOnce(null);
		const empty = await GET({
			locals: { userId: 'user-1' }
		} as Parameters<typeof GET>[0]);
		expect(empty.status).toBe(200);
		expect(await empty.json()).toMatchObject({
			canView: true,
			access: { allowed: true },
			plan: null,
			preview: { completedCount: 0, totalCount: 0, upcomingTasks: [] }
		});
	});

	it('completes a task and reports conflicts with actionable codes', async () => {
		mocks.authorizeFeatureRequest.mockResolvedValue({
			allowed: true,
			userId: 'user-1',
			planAccess: {},
			profile: {}
		});
		mocks.getCurrentStudyPlan.mockResolvedValue({
			id: 'plan-1',
			startsOn: '2026-11-03T00:00:00.000Z',
			updatedAt: '2026-11-03T12:00:00.000Z',
			tasks: []
		});
		mocks.completeStudyTask.mockResolvedValue({
			id: 'plan-1',
			startsOn: '2026-11-03T00:00:00.000Z',
			updatedAt: '2026-11-03T12:00:01.000Z',
			tasks: [
				{
					id: 'task-1',
					course: 'AP Biology',
					unit: 'Unit 1',
					mode: 'mcq',
					date: '2026-11-03T00:00:00.000Z',
					durationMinutes: 20,
					status: 'done'
				}
			]
		});

		const ok = await completeTask({
			locals: { userId: 'user-1' },
			params: { taskId: 'task-1' },
			request: new Request('https://example.com', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ expectedUpdatedAt: '2026-11-03T12:00:00.000Z' })
			})
		} as Parameters<typeof completeTask>[0]);
		expect(ok.status).toBe(200);
		const body = await ok.json();
		expect(body.plan.tasks[0].practiceDestination).toEqual({
			kind: 'practice',
			course: 'AP Biology',
			unit: 'Unit 1',
			mode: 'mcq'
		});

		mocks.getCurrentStudyPlan.mockResolvedValueOnce({
			id: 'plan-1',
			startsOn: '2026-11-03T00:00:00.000Z',
			updatedAt: '2026-11-03T13:00:00.000Z',
			tasks: []
		});
		const conflict = await completeTask({
			locals: { userId: 'user-1' },
			params: { taskId: 'task-1' },
			request: new Request('https://example.com', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ expectedUpdatedAt: '2026-11-03T12:00:00.000Z' })
			})
		} as Parameters<typeof completeTask>[0]);
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toMatchObject({ code: 'plan_conflict' });
	});
});
