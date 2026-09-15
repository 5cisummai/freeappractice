import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { KV_REST_API_URL: 'https://redis.test', KV_REST_API_TOKEN: 'test-token' }
}));

import { getRedisClient } from '$lib/redis/server';

afterEach(() => vi.unstubAllGlobals());

describe('shared Redis transport', () => {
	it('aborts stalled HTTP work and can reuse the client after a timeout', async () => {
		const signals: AbortSignal[] = [];
		const fetchMock = vi.fn((_url: unknown, options: RequestInit) => {
			const signal = options.signal!;
			signals.push(signal);
			return new Promise<Response>((_resolve, reject) => {
				signal.addEventListener('abort', () => reject(signal.reason), { once: true });
			});
		});
		vi.stubGlobal('fetch', fetchMock);
		const redis = getRedisClient()!;

		await expect(redis.get('stalled')).rejects.toHaveProperty('name', 'TimeoutError');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(signals[0].aborted).toBe(true);

		fetchMock.mockImplementationOnce(async (_url, options) => {
			expect(options.signal).not.toBe(signals[0]);
			expect(options.signal?.aborted).toBe(false);
			return Response.json([{ result: 'recovered' }]);
		});
		await expect(redis.get('healthy')).resolves.toBe('recovered');
		expect(getRedisClient()).toBe(redis);
	});
});
