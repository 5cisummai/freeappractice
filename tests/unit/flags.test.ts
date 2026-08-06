import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	flag: vi.fn((options: Record<string, unknown>) => {
		const evaluate = vi.fn();
		Object.assign(evaluate, { options });
		return evaluate;
	}),
	vercelAdapter: vi.fn(() => ({ provider: 'vercel' }))
}));

vi.mock('flags/sveltekit', () => ({ flag: mocks.flag }));
vi.mock('@flags-sdk/vercel', () => ({ vercelAdapter: mocks.vercelAdapter }));

import '$lib/flags';

describe('Vercel flag declarations', () => {
	it('attaches the provider adapter through the Flags SDK adapter option', () => {
		expect(mocks.flag).toHaveBeenCalledTimes(7);
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
});
