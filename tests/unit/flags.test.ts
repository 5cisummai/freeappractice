import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	redis: {
		get: vi.fn(),
		set: vi.fn()
	},
	baseDecide: vi.fn(async () => false),
	baseBulkDecide: vi.fn(async () => ({})),
	flag: vi.fn((options: Record<string, unknown>) => {
		const evaluate = vi.fn();
		Object.assign(evaluate, { options });
		return evaluate;
	}),
	vercelAdapter: vi.fn(() => ({
		provider: 'vercel',
		adapterId: Symbol('vercel'),
		decide: mocks.baseDecide,
		bulkDecide: mocks.baseBulkDecide
	})),
	getRedisClient: vi.fn(() => mocks.redis),
	redisNamespace: vi.fn(() => 'fap:test'),
	withRedisTimeout: vi.fn((promise: Promise<unknown>) => promise)
}));

vi.mock('flags/sveltekit', () => ({ flag: mocks.flag }));
vi.mock('@flags-sdk/vercel', () => ({ vercelAdapter: mocks.vercelAdapter }));
vi.mock('$lib/redis/server', () => ({
	getRedisClient: mocks.getRedisClient,
	redisNamespace: mocks.redisNamespace,
	withRedisTimeout: mocks.withRedisTimeout
}));

import '$lib/flags';

describe('Vercel flag declarations', () => {
	beforeEach(() => {
		mocks.redis.get.mockReset();
		mocks.redis.set.mockReset();
		mocks.baseDecide.mockReset().mockResolvedValue(false);
		mocks.baseBulkDecide.mockReset().mockResolvedValue({});
	});

	it('attaches the provider adapter through the Flags SDK adapter option', () => {
		expect(mocks.flag).toHaveBeenCalledTimes(8);
		for (const [options] of mocks.flag.mock.calls) {
			expect(options).toMatchObject({
				adapter: { provider: 'vercel' },
				options: [
					{ value: true, label: 'On' },
					{ value: false, label: 'Off' }
				]
			});
			expect(options).not.toHaveProperty('decide');
		}
	});

	it('caches global flag evaluations in Redis for one hour', async () => {
		const adapter = mocks.flag.mock.calls[0][0].adapter as {
			decide: (params: { key: string; entities?: Record<string, unknown> }) => Promise<boolean>;
		};
		mocks.redis.get.mockResolvedValueOnce(null);
		mocks.baseDecide.mockResolvedValueOnce(true);

		const value = await adapter.decide({ key: 'multi-attempt-experiment' });

		expect(value).toBe(true);
		expect(mocks.baseDecide).toHaveBeenCalledTimes(1);
		expect(mocks.redis.set).toHaveBeenCalledWith('fap:test:flags:multi-attempt-experiment', true, {
			ex: 60 * 60
		});
	});

	it('serves cached false values without calling Vercel', async () => {
		const adapter = mocks.flag.mock.calls[0][0].adapter as {
			decide: (params: { key: string; entities?: Record<string, unknown> }) => Promise<boolean>;
		};
		mocks.redis.get.mockResolvedValueOnce(false);

		const value = await adapter.decide({ key: 'multi-attempt-experiment' });

		expect(value).toBe(false);
		expect(mocks.baseDecide).not.toHaveBeenCalled();
	});
});
