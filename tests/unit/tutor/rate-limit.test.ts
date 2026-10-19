import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getRedisClient: vi.fn(),
	hashRedisIdentifier: vi.fn(),
	withRedisTimeout: vi.fn(),
	limit: vi.fn(),
	slidingWindow: vi.fn()
}));

vi.mock('@upstash/ratelimit', () => ({
	Ratelimit: class {
		static slidingWindow = mocks.slidingWindow;
		limit = mocks.limit;
	}
}));

vi.mock('#lib/redis/server.js', () => ({
	getRedisClient: mocks.getRedisClient,
	hashRedisIdentifier: mocks.hashRedisIdentifier,
	redisNamespace: () => 'fap:test',
	withRedisTimeout: mocks.withRedisTimeout
}));

import { limitGenericTutor } from '#lib/tutor/rate-limit.server.js';

describe('limitGenericTutor', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRedisClient.mockReturnValue({});
		mocks.hashRedisIdentifier.mockReturnValue('hashed-ip');
		mocks.slidingWindow.mockReturnValue({});
		mocks.withRedisTimeout.mockImplementation((promise) => promise);
		mocks.limit.mockResolvedValue({ success: true, reset: 0 });
	});

	it('fails closed for anonymous callers when Redis is unavailable', async () => {
		mocks.getRedisClient.mockReturnValue(null);

		await expect(
			limitGenericTutor(new Request('https://app.test/api/tutor/chat'), undefined)
		).resolves.toEqual({
			allowed: false,
			retryAt: null,
			degraded: true
		});
	});

	it('fails open for signed-in callers when Redis is unavailable', async () => {
		mocks.getRedisClient.mockReturnValue(null);

		await expect(
			limitGenericTutor(new Request('https://app.test/api/tutor/chat'), 'user-1')
		).resolves.toEqual({
			allowed: true,
			retryAt: null,
			degraded: true
		});
	});

	it('fails closed for anonymous callers on Redis timeout', async () => {
		mocks.withRedisTimeout.mockResolvedValue({ reason: 'timeout' });

		await expect(
			limitGenericTutor(new Request('https://app.test/api/tutor/chat'), undefined)
		).resolves.toEqual({
			allowed: false,
			retryAt: null,
			degraded: true
		});
	});
});
