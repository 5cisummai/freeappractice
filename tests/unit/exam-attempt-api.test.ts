import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	row: null as unknown,
	updated: null as unknown,
	set: vi.fn(),
	publishPersonalPracticeActivity: vi.fn()
}));
vi.mock('#lib/auth/route-helpers.server.js', () => ({
	withAuthedHandler:
		(handler: (event: unknown, userId: string) => unknown) =>
		(event: { locals: { userId: string } }) =>
			handler(event, event.locals.userId)
}));
vi.mock('#lib/users/practice-context.server.js', () => ({
	assertPracticeContextAccess: vi.fn(),
	requirePracticeSession: vi.fn()
}));
vi.mock('#lib/auth/organization-queries.server.js', () => ({
	publishPersonalPracticeActivity: mocks.publishPersonalPracticeActivity
}));
vi.mock('#lib/server/neon/schema.js', () => ({
	examAttempts: { id: {}, userId: {}, status: {}, revision: {} }
}));
vi.mock('drizzle-orm', () => ({
	and: (...args: unknown[]) => args,
	eq: (...args: unknown[]) => args,
	sql: (...args: unknown[]) => args
}));
vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		select: () => ({
			from: () => ({ where: () => ({ limit: async () => (mocks.row ? [mocks.row] : []) }) })
		}),
		update: () => ({
			set: (value: unknown) => {
				mocks.set(value);
				return { where: () => ({ returning: async () => (mocks.updated ? [mocks.updated] : []) }) };
			}
		})
	})
}));
import { PATCH } from '../../src/routes/api/me/exam-attempts/[id]/+server';

const section = {
	id: 's',
	kind: 'mcq',
	title: 'MCQ',
	timeLimitMs: 60000,
	items: [{ id: 'q', questionId: 'question' }]
};
function event(payload: unknown) {
	return {
		params: { id: 'exam' },
		locals: { userId: 'user' },
		request: new Request('http://localhost', { method: 'PATCH', body: JSON.stringify(payload) })
	} as never;
}

describe('exam section saves', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.row = {
			revision: 0,
			status: 'in_progress',
			sectionIndex: 0,
			sectionStartedAt: new Date(),
			sectionCompletedAt: [],
			sections: [section],
			responses: {}
		};
		mocks.updated = {
			id: 'exam',
			course: 'AP Biology',
			organizationId: null,
			responses: {},
			submittedAt: new Date()
		};
		mocks.publishPersonalPracticeActivity.mockResolvedValue(undefined);
	});
	it('saves answers for the active section', async () => {
		const response = await PATCH(event({ action: 'save', revision: 0, responses: { q: 'A' } }));
		expect(response.status).toBe(200);
		expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ responses: { q: 'A' } }));
	});
	it('rejects stale revisions and answers for other sections', async () => {
		expect((await PATCH(event({ action: 'save', revision: 1, responses: {} }))).status).toBe(409);
		expect(
			(await PATCH(event({ action: 'save', revision: 0, responses: { other: 'A' } }))).status
		).toBe(400);
	});
	it('rejects late answers but allows an expired section to finish', async () => {
		(mocks.row as { sectionStartedAt: Date }).sectionStartedAt = new Date(Date.now() - 120000);
		expect(
			(await PATCH(event({ action: 'save', revision: 0, responses: { q: 'A' } }))).status
		).toBe(409);
		expect((await PATCH(event({ action: 'finish', revision: 0 }))).status).toBe(200);
		expect(mocks.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'submitted', responses: {} })
		);
	});
	it('starts a section only once and leaves an untimed section open', async () => {
		(mocks.row as { sectionStartedAt: Date | null }).sectionStartedAt = null;
		expect((await PATCH(event({ action: 'start', revision: 0 }))).status).toBe(200);
		expect(mocks.set).toHaveBeenCalledWith(
			expect.objectContaining({ sectionStartedAt: expect.any(Date) })
		);
		(mocks.row as { sectionStartedAt: Date }).sectionStartedAt = new Date(Date.now() - 120000);
		(mocks.row as { sections: unknown[] }).sections = [{ ...section, timeLimitMs: null }];
		expect(
			(await PATCH(event({ action: 'save', revision: 0, responses: { q: 'A' } }))).status
		).toBe(200);
	});
	it('advances to the next section without starting its clock', async () => {
		(mocks.row as { sections: unknown[] }).sections = [section, { ...section, id: 'next' }];
		expect((await PATCH(event({ action: 'finish', revision: 0 }))).status).toBe(200);
		expect(mocks.set).toHaveBeenCalledWith(
			expect.objectContaining({ sectionIndex: 1, sectionStartedAt: null, status: 'in_progress' })
		);
	});
	it('refuses access when the owned attempt is not found', async () => {
		mocks.row = null;
		expect((await PATCH(event({ action: 'start', revision: 0 }))).status).toBe(404);
	});
});
