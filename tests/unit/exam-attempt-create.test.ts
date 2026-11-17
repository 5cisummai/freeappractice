import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	assembleExamSections: vi.fn(),
	createExamAttempt: vi.fn(),
	resolveRequestPracticeContext: vi.fn()
}));

vi.mock('#lib/auth/route-helpers.server.js', () => ({
	withAuthedHandler:
		(handler: (event: unknown, userId: string) => unknown) =>
		(event: { locals: { userId: string } }) =>
			handler(event, event.locals.userId)
}));

vi.mock('#lib/exams/assemble.server.js', () => ({
	assembleExamSections: mocks.assembleExamSections
}));

vi.mock('#lib/users/exam-attempts.server.js', () => ({
	listExamAttempts: vi.fn(),
	createExamAttempt: mocks.createExamAttempt
}));

vi.mock('#lib/users/practice-context.server.js', () => ({
	resolveRequestPracticeContext: mocks.resolveRequestPracticeContext
}));

import { POST } from '../../src/routes/api/me/exam-attempts/+server';

function event(body: unknown) {
	return {
		locals: { userId: 'user' },
		request: new Request('http://localhost/api/me/exam-attempts', {
			method: 'POST',
			body: JSON.stringify(body),
			headers: { 'content-type': 'application/json' }
		})
	} as never;
}

describe('POST /api/me/exam-attempts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resolveRequestPracticeContext.mockResolvedValue({ organizationId: null });
		mocks.createExamAttempt.mockResolvedValue({ id: 'exam-1', course: 'AP Biology' });
	});

	it('requires a course', async () => {
		const response = await POST(event({}));
		expect(response.status).toBe(400);
	});

	it('returns 400 for unsupported courses', async () => {
		mocks.assembleExamSections.mockResolvedValue({
			ok: false,
			code: 'unsupported',
			reason: 'Unknown course "Nope".'
		});
		const response = await POST(event({ course: 'Nope' }));
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Unknown course "Nope".' });
	});

	it('returns 503 with retry when the pool is warming', async () => {
		mocks.assembleExamSections.mockResolvedValue({
			ok: false,
			code: 'warming',
			reason: 'warming',
			retryAfterSeconds: 15
		});
		const response = await POST(event({ course: 'AP Biology' }));
		expect(response.status).toBe(503);
		expect(response.headers.get('Retry-After')).toBe('15');
		await expect(response.json()).resolves.toMatchObject({ code: 'POOL_WARMING' });
	});

	it('creates an attempt when assembly succeeds', async () => {
		const sections = [
			{
				id: 'multiple-choice',
				kind: 'mcq',
				title: 'Section I',
				timeLimitMs: 1000,
				items: [{ id: 'multiple-choice-001', questionId: 'q1' }]
			}
		];
		mocks.assembleExamSections.mockResolvedValue({
			ok: true,
			course: 'AP Biology',
			sections
		});
		const response = await POST(event({ course: 'AP Biology' }));
		expect(response.status).toBe(201);
		expect(mocks.createExamAttempt).toHaveBeenCalledWith(
			'user',
			{ organizationId: null },
			{ course: 'AP Biology', sections }
		);
		await expect(response.json()).resolves.toEqual({
			attempt: { id: 'exam-1', course: 'AP Biology' }
		});
	});
});
