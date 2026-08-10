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

vi.mock('$lib/redis/server', () => ({
	getRedisClient: mocks.getRedisClient,
	hashRedisIdentifier: mocks.hashRedisIdentifier,
	redisNamespace: () => 'fap:test',
	withRedisTimeout: mocks.withRedisTimeout
}));

import { limitBugReports } from '$lib/bug-report/rate-limit.server';

describe('distributed bug-report rate limit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRedisClient.mockReturnValue({});
		mocks.hashRedisIdentifier.mockReturnValue('hashed-ip');
		mocks.slidingWindow.mockReturnValue({});
		mocks.withRedisTimeout.mockImplementation((promise) => promise);
	});

	it('uses a hashed client identifier in the shared Redis limiter', async () => {
		mocks.limit.mockResolvedValue({ success: false, reset: 123_000 });

		await expect(limitBugReports('203.0.113.8')).resolves.toEqual({
			allowed: false,
			retryAt: 123_000,
			degraded: false
		});
		expect(mocks.hashRedisIdentifier).toHaveBeenCalledWith('203.0.113.8');
		expect(mocks.limit).toHaveBeenCalledWith('hashed-ip');
	});

	it('fails open explicitly when Redis is unavailable', async () => {
		mocks.getRedisClient.mockReturnValue(null);

		await expect(limitBugReports('203.0.113.8')).resolves.toEqual({
			allowed: true,
			retryAt: null,
			degraded: true
		});
	});
});
