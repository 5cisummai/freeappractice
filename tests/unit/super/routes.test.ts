import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	withAuthedHandler:
		(handler: (event: unknown, userId: string) => Promise<Response>) => (event: unknown) =>
			handler(event, 'user-1'),
	getTutorProfileView: vi.fn(),
	getTutorProfileViewForRequest: vi.fn(),
	updateTutorProfile: vi.fn(),
	confirmAge: vi.fn(),
	markMemoryDisclosureSeen: vi.fn(),
	isTutorMemoryConfigured: vi.fn(),
	listTutorMemories: vi.fn(),
	getTutorMemoryPublicId: vi.fn(),
	resolveTutorMemoryId: vi.fn(),
	deleteAllTutorMemories: vi.fn(),
	deleteTutorMemory: vi.fn(),
	isSuperMemoryEnabled: vi.fn(),
	authorizeFeatureRequest: vi.fn(),
	insightsGet: vi.fn(),
	insightsPost: vi.fn(),
	studyPlanGet: vi.fn(),
	studyPlanPost: vi.fn(),
	coachApprovalPost: vi.fn(),
	coachUndoPost: vi.fn()
}));

vi.mock('$lib/auth/route-helpers.server', () => ({
	withAuthedHandler: mocks.withAuthedHandler
}));
vi.mock('$lib/super/profile.server', () => ({
	getTutorProfileView: mocks.getTutorProfileView,
	updateTutorProfile: mocks.updateTutorProfile,
	confirmAge: mocks.confirmAge,
	markMemoryDisclosureSeen: mocks.markMemoryDisclosureSeen
}));
vi.mock('$lib/mem0/service.server', () => ({
	isTutorMemoryConfigured: mocks.isTutorMemoryConfigured,
	listTutorMemories: mocks.listTutorMemories,
	getTutorMemoryPublicId: mocks.getTutorMemoryPublicId,
	resolveTutorMemoryId: mocks.resolveTutorMemoryId,
	deleteAllTutorMemories: mocks.deleteAllTutorMemories,
	deleteTutorMemory: mocks.deleteTutorMemory
}));
vi.mock('$lib/flags', () => ({
	isSuperMemoryEnabled: mocks.isSuperMemoryEnabled
}));
vi.mock('$lib/super/feature-access.server', () => ({
	authorizeFeatureRequest: mocks.authorizeFeatureRequest,
	getTutorProfileViewForRequest: mocks.getTutorProfileViewForRequest
}));
vi.mock('../../../src/routes/api/insights/+server', () => ({
	GET: mocks.insightsGet,
	POST: mocks.insightsPost
}));
vi.mock('../../../src/routes/api/study-plan/+server', () => ({
	GET: mocks.studyPlanGet,
	POST: mocks.studyPlanPost
}));
vi.mock('../../../src/routes/api/coach/approval/+server', () => ({
	POST: mocks.coachApprovalPost
}));
vi.mock('../../../src/routes/api/coach/undo/+server', () => ({
	POST: mocks.coachUndoPost
}));

import { POST as confirmAgePost } from '../../../src/routes/api/super/confirm-age/+server';
import { InvalidBirthDateError, UnderAgeError } from '$lib/auth/age';
import {
	POST as memoryPost,
	GET as memoryGet,
	DELETE as memoryDelete
} from '../../../src/routes/api/super/memory/+server';
import { DELETE as memoryIdDelete } from '../../../src/routes/api/super/memory/[memoryId]/+server';
import {
	GET as profileGet,
	PATCH as profilePatch
} from '../../../src/routes/api/super/profile/+server';
import {
	GET as meProfileGet,
	PATCH as meProfilePatch
} from '../../../src/routes/api/me/tutor-profile/+server';
import {
	GET as meMemoriesGet,
	DELETE as meMemoriesDelete
} from '../../../src/routes/api/me/tutor-memories/+server';
import { DELETE as meMemoryIdDelete } from '../../../src/routes/api/me/tutor-memories/[memoryId]/+server';
import {
	GET as meInsightsGet,
	POST as meInsightsPost
} from '../../../src/routes/api/me/insights/+server';
import {
	GET as meStudyPlanGet,
	PATCH as meStudyPlanPatch
} from '../../../src/routes/api/me/study-plan/+server';
import { POST as coachAuthorizePost } from '../../../src/routes/api/coach/session/authorize/+server';
import { POST as coachActionUndoPost } from '../../../src/routes/api/coach/actions/[id]/undo/+server';

const profile = {
	ageConfirmedAt: null,
	selectedApClasses: [],
	targetDates: [],
	studyAvailability: '',
	teachingStyle: 'socratic' as const,
	memoryEnabled: true,
	memoryDisclosureSeenAt: null
};

type TestEvent = Parameters<typeof profileGet>[0];

function event(body?: unknown, params: Record<string, string> = {}): TestEvent {
	return {
		request: new Request('http://localhost/api/super', {
			method: body === undefined ? 'GET' : 'POST',
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			headers: { 'content-type': 'application/json' }
		}),
		params,
		locals: {}
	} as TestEvent;
}

describe('Super API routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getTutorProfileView.mockResolvedValue(profile);
		mocks.getTutorProfileViewForRequest.mockResolvedValue(profile);
		mocks.updateTutorProfile.mockResolvedValue(profile);
		mocks.confirmAge.mockResolvedValue({ ...profile, ageConfirmedAt: '2026-08-04T00:00:00.000Z' });
		mocks.isTutorMemoryConfigured.mockReturnValue(true);
		mocks.listTutorMemories.mockResolvedValue([
			{ id: 'mem0-secret-id', text: 'Prefers concise explanations.', createdAt: null }
		]);
		mocks.getTutorMemoryPublicId.mockResolvedValue('memory-token');
		mocks.resolveTutorMemoryId.mockResolvedValue('mem0-secret-id');
		mocks.isSuperMemoryEnabled.mockResolvedValue(true);
		mocks.authorizeFeatureRequest.mockResolvedValue({ allowed: true });
		mocks.coachUndoPost.mockResolvedValue(new Response(null, { status: 204 }));
	});

	it('maps the named API contracts to their canonical handlers', () => {
		expect(meProfileGet).toBe(profileGet);
		expect(meProfilePatch).toBe(profilePatch);
		expect(meMemoriesGet).toBe(memoryGet);
		expect(meMemoriesDelete).toBe(memoryDelete);
		expect(meMemoryIdDelete).toBe(memoryIdDelete);
		expect(meInsightsGet).toBe(mocks.insightsGet);
		expect(meInsightsPost).toBe(mocks.insightsPost);
		expect(meStudyPlanGet).toBe(mocks.studyPlanGet);
		expect(meStudyPlanPatch).toBe(mocks.studyPlanPost);
		expect(coachAuthorizePost).toBe(mocks.coachApprovalPost);
	});

	it('takes Coach undo audit ID from the route parameter', async () => {
		const response = await coachActionUndoPost(
			event(
				{ auditId: 'body-value-must-be-ignored' },
				{ id: '0123456789abcdef01234567' }
			) as Parameters<typeof coachActionUndoPost>[0]
		);

		expect(response.status).toBe(204);
		const forwardedEvent = mocks.coachUndoPost.mock.calls[0][0] as { request: Request };
		expect(await forwardedEvent.request.json()).toEqual({
			auditId: '0123456789abcdef01234567'
		});
	});

	it('returns profile and memory status', async () => {
		const response = await profileGet(event());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.profile).toEqual(profile);
		expect(body.memory).toMatchObject({ enabled: true, configured: true });
	});

	it('rejects unknown profile fields and accepts bounded profile fields', async () => {
		const invalid = await profilePatch(event({ selectedApClasses: [], unexpected: true }));
		expect(invalid.status).toBe(400);
		expect(mocks.updateTutorProfile).not.toHaveBeenCalled();

		const valid = await profilePatch(
			event({
				selectedApClasses: ['AP Biology'],
				targetDates: [{ apClass: 'AP Biology', targetDate: '2027-05-10' }],
				studyAvailability: 'Weeknights',
				teachingStyle: 'step_by_step',
				memoryEnabled: false
			})
		);
		expect(valid.status).toBe(200);
		expect(mocks.updateTutorProfile).toHaveBeenCalledWith('user-1', {
			selectedApClasses: ['AP Biology'],
			targetDates: [{ apClass: 'AP Biology', targetDate: '2027-05-10' }],
			studyAvailability: 'Weeknights',
			teachingStyle: 'step_by_step',
			memoryEnabled: false
		});
	});

	it('records age confirmation from the authenticated POST action', async () => {
		const valid = await confirmAgePost(event());
		expect(valid.status).toBe(200);
		expect(mocks.confirmAge).toHaveBeenCalledWith('user-1', undefined);
	});

	it('forwards a valid birth date to the authenticated POST action', async () => {
		const valid = await confirmAgePost(event({ birthDate: '2010-08-04' }));
		expect(valid.status).toBe(200);
		expect(mocks.confirmAge).toHaveBeenCalledWith('user-1', '2010-08-04');
	});

	it('returns 400 for an invalid birth date', async () => {
		mocks.confirmAge.mockRejectedValueOnce(new InvalidBirthDateError());
		const rejected = await confirmAgePost(event({ birthDate: 'not-a-date' }));
		expect(rejected.status).toBe(400);
	});

	it('returns 403 for an underage birth date', async () => {
		mocks.confirmAge.mockRejectedValueOnce(new UnderAgeError());
		const rejected = await confirmAgePost(event({ birthDate: '2018-08-04' }));
		expect(rejected.status).toBe(403);
		expect(await rejected.json()).toMatchObject({ underAge: true });
	});

	it('acknowledges memory disclosure without requiring Super subscription', async () => {
		mocks.getTutorProfileView.mockResolvedValue({
			...profile,
			ageConfirmedAt: '2026-08-04T00:00:00.000Z'
		});
		const acknowledged = await memoryPost(event());
		expect(acknowledged.status).toBe(200);
		expect(mocks.markMemoryDisclosureSeen).toHaveBeenCalledWith('user-1');
	});

	it('lists memories without exposing Mem0 ids', async () => {
		const response = await memoryGet(event());
		const body = await response.json();
		expect(body.memories).toEqual([
			{ id: 'memory-token', text: 'Prefers concise explanations.', createdAt: null }
		]);
		expect(JSON.stringify(body)).not.toContain('mem0-secret-id');
	});

	it('rejects memory disclosure before age confirmation', async () => {
		mocks.getTutorProfileView.mockResolvedValue({ ...profile, ageConfirmedAt: null });
		const denied = await memoryPost(event());
		expect(denied.status).toBe(403);
		expect(mocks.markMemoryDisclosureSeen).not.toHaveBeenCalled();
	});

	it('deletes all memories or one selected memory', async () => {
		const all = await memoryDelete(event());
		expect(all.status).toBe(200);
		expect(mocks.deleteAllTutorMemories).toHaveBeenCalledWith('user-1');

		const one = await memoryIdDelete(event(undefined, { memoryId: 'memory-token' }));
		expect(one.status).toBe(200);
		expect(mocks.deleteTutorMemory).toHaveBeenCalledWith('user-1', 'mem0-secret-id');
	});
});
