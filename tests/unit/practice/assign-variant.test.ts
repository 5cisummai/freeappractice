import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isMultiAttemptExperimentEnabled: vi.fn(),
	findUserProfileOrFail: vi.fn()
}));

vi.mock('$lib/flags', () => ({
	isMultiAttemptExperimentEnabled: mocks.isMultiAttemptExperimentEnabled
}));
vi.mock('$lib/users/profile.server', () => ({
	findUserProfileOrFail: mocks.findUserProfileOrFail
}));

import { getOrAssignMultiAttemptVariant } from '$lib/practice/assign-variant.server';

describe('getOrAssignMultiAttemptVariant', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isMultiAttemptExperimentEnabled.mockResolvedValue(false);
	});

	it('does not persist a control assignment while the experiment is disabled', async () => {
		const user = { practiceExperiments: [], save: vi.fn() };
		mocks.findUserProfileOrFail.mockResolvedValue(user);

		await expect(getOrAssignMultiAttemptVariant('user-1')).resolves.toMatchObject({
			assigned: 'control',
			enabled: false,
			assignment: {
				key: 'multi_attempt_hints',
				version: 2,
				variant: 'control'
			}
		});
		expect(user.save).not.toHaveBeenCalled();
	});

	it('persists a stable assignment when the experiment is enabled', async () => {
		const user = { practiceExperiments: [], save: vi.fn() };
		mocks.findUserProfileOrFail.mockResolvedValue(user);
		mocks.isMultiAttemptExperimentEnabled.mockResolvedValue(true);

		const result = await getOrAssignMultiAttemptVariant('user-1');

		expect(result.enabled).toBe(true);
		expect(['control', 'multi_attempt_hints']).toContain(result.assigned);
		expect(user.practiceExperiments).toEqual([result.assignment]);
		expect(user.save).toHaveBeenCalledOnce();
	});
});
