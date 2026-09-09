import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
	getSession: vi.fn()
}));

vi.mock('$lib/auth/server', () => ({
	auth: { api: { getSession: mocks.getSession } }
}));

import { getOptionalUserId } from '$lib/auth/route-helpers.server';

function eventWith(locals: App.Locals): RequestEvent {
	return {
		locals,
		request: new Request('https://freeappractice.org/api/test')
	} as RequestEvent;
}

describe('getOptionalUserId', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reuses an authenticated hook result', async () => {
		const userId = await getOptionalUserId(eventWith({ userId: 'user-1' }));

		expect(userId).toBe('user-1');
		expect(mocks.getSession).not.toHaveBeenCalled();
	});

	it('reuses a completed anonymous hook result', async () => {
		const userId = await getOptionalUserId(eventWith({ sessionLookupStatus: 'complete' }));

		expect(userId).toBeUndefined();
		expect(mocks.getSession).not.toHaveBeenCalled();
	});

	it('retries a failed hook lookup and populates locals', async () => {
		mocks.getSession.mockResolvedValueOnce({
			session: { id: 'session-1' },
			user: { id: 'user-1' }
		});
		const locals: App.Locals = { sessionLookupStatus: 'failed' };

		expect(await getOptionalUserId(eventWith(locals))).toBe('user-1');
		expect(locals).toMatchObject({
			userId: 'user-1',
			sessionLookupStatus: 'complete'
		});
		expect(mocks.getSession).toHaveBeenCalledTimes(1);
	});
});
