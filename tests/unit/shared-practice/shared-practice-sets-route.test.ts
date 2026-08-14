import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createSharedQuiz: vi.fn(),
	limitSharedPracticeSetCreation: vi.fn(),
	getSiteUrl: vi.fn(() => 'https://freeappractice.org'),
	loggerError: vi.fn()
}));

vi.mock('$lib/shared-practice/shared-sets.server', async () => {
	const actual = await vi.importActual<typeof import('$lib/shared-practice/shared-sets.server')>(
		'$lib/shared-practice/shared-sets.server'
	);
	return {
		...actual,
		createSharedQuiz: mocks.createSharedQuiz
	};
});

vi.mock('$lib/shared-practice/rate-limit.server', () => ({
	limitSharedPracticeSetCreation: mocks.limitSharedPracticeSetCreation
}));

vi.mock('$lib/site-url', () => ({
	getSiteUrl: mocks.getSiteUrl
}));

vi.mock('$lib/server/logger', () => ({
	logger: { error: mocks.loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { SharedQuizValidationError } from '$lib/shared-practice/shared-sets.server';
import { POST } from '../../../src/routes/api/shared-practice-sets/+server';

function post(body: unknown, userId?: string) {
	return POST({
		request: new Request('https://freeappractice.org/api/shared-practice-sets', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { userId },
		url: new URL('https://freeappractice.org/api/shared-practice-sets')
	} as Parameters<typeof POST>[0]);
}

describe('POST /api/shared-practice-sets', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.limitSharedPracticeSetCreation.mockResolvedValue({
			allowed: true,
			retryAt: null,
			degraded: false
		});
	});

	it('rejects a non-string questionIds payload', async () => {
		const response = await post({ questionIds: [1, 2] });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'questionIds must be an array of strings.' });
		expect(mocks.createSharedQuiz).not.toHaveBeenCalled();
	});

	it('returns 400 when quiz validation fails', async () => {
		mocks.createSharedQuiz.mockRejectedValueOnce(
			new SharedQuizValidationError('A shared quiz must contain 1–50 unique questions.')
		);

		const response = await post({ questionIds: ['question-1'] });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'A shared quiz must contain 1–50 unique questions.'
		});
	});

	it('returns 429 when share creation is rate limited', async () => {
		mocks.limitSharedPracticeSetCreation.mockResolvedValueOnce({
			allowed: false,
			retryAt: Date.now() + 10_000,
			degraded: false
		});

		const response = await post({ questionIds: ['question-1'] });
		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBeTruthy();
		expect(mocks.createSharedQuiz).not.toHaveBeenCalled();
	});

	it('returns a canonical share URL on success', async () => {
		mocks.createSharedQuiz.mockResolvedValueOnce({
			id: 'set-1',
			slug: 'abcdefghij',
			title: 'AP Biology — 1 Questions',
			expiresAt: '2026-11-12T00:00:00.000Z'
		});

		const response = await post({ questionIds: ['question-1'], unit: 'All Units' }, 'user-1');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			sharedQuiz: {
				id: 'set-1',
				slug: 'abcdefghij',
				title: 'AP Biology — 1 Questions',
				expiresAt: '2026-11-12T00:00:00.000Z',
				url: 'https://freeappractice.org/q/abcdefghij'
			}
		});
		expect(mocks.createSharedQuiz).toHaveBeenCalledWith({
			questionIds: ['question-1'],
			unit: 'All Units',
			creatorUserId: 'user-1'
		});
	});

	it('returns 500 when share creation throws an unexpected error', async () => {
		mocks.createSharedQuiz.mockRejectedValueOnce(
			new Error('column "position" is of type integer but expression is of type text')
		);

		const response = await post({ questionIds: ['question-1'] });
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Could not create a share link.' });
		expect(mocks.loggerError).toHaveBeenCalled();
	});
});
