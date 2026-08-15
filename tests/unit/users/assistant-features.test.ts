import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ limit: vi.fn() }));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		select: () => ({
			from: () => ({ where: () => ({ limit: mocks.limit }) })
		})
	})
}));

import {
	getAssistantFeaturesEnabled,
	getAssistantFeaturesEnabledForRequest
} from '$lib/super/assistant.server';

describe('assistant feature preference', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.limit.mockResolvedValue([{ enabled: true }]);
	});

	it('defaults to enabled when a profile row is missing', async () => {
		mocks.limit.mockResolvedValueOnce([]);
		await expect(getAssistantFeaturesEnabled('user-1')).resolves.toBe(true);
	});

	it('shares one preference read within a request', async () => {
		const locals = {} as App.Locals;
		const first = getAssistantFeaturesEnabledForRequest(locals, 'user-1');
		const second = getAssistantFeaturesEnabledForRequest(locals, 'user-1');

		expect(second).toBe(first);
		await expect(first).resolves.toBe(true);
		expect(mocks.limit).toHaveBeenCalledOnce();
	});
});
