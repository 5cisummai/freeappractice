import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	baseDecide: vi.fn(async () => false),
	baseBulkDecide: vi.fn(async () => ({})),
	flag: vi.fn((options: Record<string, unknown>) => {
		const evaluate = vi.fn();
		Object.assign(evaluate, { options });
		return evaluate;
	}),
	vercelAdapter: vi.fn(() => ({
		adapterId: Symbol('vercel'),
		decide: mocks.baseDecide,
		bulkDecide: mocks.baseBulkDecide
	}))
}));

vi.mock('flags/sveltekit', () => ({ flag: mocks.flag }));
vi.mock('@flags-sdk/vercel', () => ({ vercelAdapter: mocks.vercelAdapter }));

import '#lib/flags.js';

function declaredAdapter() {
	return mocks.flag.mock.calls[0][0].adapter as {
		decide: (params: { key: string; entities?: Record<string, unknown> }) => Promise<boolean>;
	};
}

describe('Vercel flag declarations', () => {
	beforeEach(() => {
		mocks.vercelAdapter.mockClear();
		mocks.baseDecide.mockReset().mockResolvedValue(false);
		mocks.baseBulkDecide.mockReset().mockResolvedValue({});
	});

	it('evaluates through Vercel Flags on first use', async () => {
		mocks.baseDecide.mockResolvedValueOnce(true);

		const value = await declaredAdapter().decide({ key: 'frq-practice' });

		expect(value).toBe(true);
		expect(mocks.vercelAdapter).toHaveBeenCalledTimes(1);
		expect(mocks.baseDecide).toHaveBeenCalledTimes(1);
	});
});
