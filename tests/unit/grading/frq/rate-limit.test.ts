import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getRedisClient: vi.fn(),
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
	redisNamespace: () => 'fap:test',
	withRedisTimeout: mocks.withRedisTimeout
}));

import { limitFrqGrading } from '#lib/grading/frq/rate-limit.server.js';

describe('limitFrqGrading', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRedisClient.mockReturnValue({});
		mocks.slidingWindow.mockReturnValue({});
		mocks.withRedisTimeout.mockImplementation((promise) => promise);
		mocks.limit.mockResolvedValue({ success: true, reset: 0 });
	});

	it('enforces the per-user window before the per-question cooldown', async () => {
		mocks.limit.mockResolvedValueOnce({ success: false, reset: 123_000 });
		await expect(limitFrqGrading('user-1', 'question-1')).resolves.toEqual({
			allowed: false,
			retryAt: 123_000,
			degraded: false
		});
		expect(mocks.limit).toHaveBeenCalledTimes(1);
		expect(mocks.limit).toHaveBeenCalledWith('user:user-1');

		mocks.limit.mockReset();
		mocks.limit
			.mockResolvedValueOnce({ success: true, reset: 0 })
			.mockResolvedValueOnce({ success: false, reset: 456_000 });
		await expect(limitFrqGrading('user-1', 'question-1')).resolves.toEqual({
			allowed: false,
			retryAt: 456_000,
			degraded: false
		});
		expect(mocks.limit).toHaveBeenNthCalledWith(2, 'user:user-1:q:question-1');
	});

	it('fails closed when Redis is unavailable', async () => {
		mocks.getRedisClient.mockReturnValue(null);

		await expect(limitFrqGrading('user-1', 'question-1')).resolves.toEqual({
			allowed: false,
			retryAt: null,
			degraded: true
		});
	});
});
