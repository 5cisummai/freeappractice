import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	usage: vi.fn(),
	warning: vi.fn(),
	courses: vi.fn(),
	billing: vi.fn(),
	beta: vi.fn()
}));
vi.mock('#lib/flags.js', () => ({ isSuperFreeBetaEnabled: mocks.beta }));
vi.mock('#lib/agent/usage/controls.server.js', () => ({
	getPersonalizedUsage: mocks.usage,
	getPersonalizedUsageWarning: mocks.warning
}));
vi.mock('#lib/users/model.server.js', () => ({ getUserCourses: mocks.courses }));
vi.mock('#lib/billing/subscriptions.server.js', () => ({ getSuperBillingView: mocks.billing }));

import { getUserSettings } from '#lib/users/settings.server.js';

const profile = {} as Parameters<typeof getUserSettings>[2];

describe('getUserSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.courses.mockResolvedValue(['AP Biology']);
		mocks.billing.mockResolvedValue({ status: 'active' });
		mocks.beta.mockResolvedValue(false);
	});

	it('does not read usage for a free plan', async () => {
		const result = await getUserSettings(
			'student-1',
			{ plan: 'free', accessReason: null },
			profile
		);
		expect(result.usage).toEqual({ status: 'not_available' });
		expect(result.selectedCourses).toEqual(['AP Biology']);
		expect(mocks.usage).not.toHaveBeenCalled();
	});

	it('reports unavailable usage without failing the rest of paid settings', async () => {
		mocks.usage.mockRejectedValue(new Error('unavailable'));
		const result = await getUserSettings(
			'student-1',
			{ plan: 'super', accessReason: 'subscription' },
			profile
		);
		expect(mocks.usage).toHaveBeenCalledWith('student-1', 'subscription');
		expect(result.usage).toEqual({ status: 'unavailable' });
		expect(result.billing).toEqual({ status: 'active' });
	});
});
