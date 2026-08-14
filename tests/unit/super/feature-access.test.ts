import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isSuperCoachEnabled: vi.fn(),
	isSuperInsightsEnabled: vi.fn(),
	isSuperMemoryEnabled: vi.fn(),
	getPlanAccessForRequest: vi.fn(),
	getTutorProfileViewForRequest: vi.fn(),
	getAssistantFeaturesEnabledForRequest: vi.fn()
}));

vi.mock('$lib/flags', () => ({
	isSuperCoachEnabled: mocks.isSuperCoachEnabled,
	isSuperInsightsEnabled: mocks.isSuperInsightsEnabled,
	isSuperMemoryEnabled: mocks.isSuperMemoryEnabled
}));
vi.mock('$lib/super/plan-access-cache.server', () => ({
	getPlanAccessForRequest: mocks.getPlanAccessForRequest
}));
vi.mock('$lib/super/profile-cache.server', () => ({
	getTutorProfileViewForRequest: mocks.getTutorProfileViewForRequest
}));
vi.mock('$lib/users/assistant-features.server', () => ({
	getAssistantFeaturesEnabledForRequest: mocks.getAssistantFeaturesEnabledForRequest
}));

import { authorizeFeatureRequest } from '$lib/super/feature-access.server';

const profile = {
	ageConfirmedAt: '2026-08-04T00:00:00.000Z'
} as any;

describe('authorizeFeatureRequest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isSuperCoachEnabled.mockResolvedValue(true);
		mocks.isSuperInsightsEnabled.mockResolvedValue(true);
		mocks.isSuperMemoryEnabled.mockResolvedValue(true);
		mocks.getPlanAccessForRequest.mockResolvedValue({
			plan: 'super',
			accessReason: 'subscription'
		});
		mocks.getTutorProfileViewForRequest.mockResolvedValue(profile);
		mocks.getAssistantFeaturesEnabledForRequest.mockResolvedValue(true);
	});

	it('checks the kill switch before billing', async () => {
		mocks.isSuperCoachEnabled.mockResolvedValue(false);
		const result = await authorizeFeatureRequest({ locals: {} }, 'user-1', 'coach');

		expect(result).toMatchObject({
			allowed: false,
			status: 503,
			code: 'feature_disabled'
		});
		expect(mocks.getPlanAccessForRequest).not.toHaveBeenCalled();
	});

	it('denies unpaid access without reading the profile', async () => {
		mocks.getPlanAccessForRequest.mockResolvedValue({ plan: 'free', accessReason: null });
		const result = await authorizeFeatureRequest({ locals: {} }, 'user-1', 'aiInsights');

		expect(result).toMatchObject({
			allowed: false,
			status: 403,
			code: 'subscription_required',
			message: 'Super subscription required'
		});
		expect(mocks.getTutorProfileViewForRequest).not.toHaveBeenCalled();
	});

	it('denies disabled assistant features before billing, but leaves memory management available', async () => {
		mocks.getAssistantFeaturesEnabledForRequest.mockResolvedValue(false);
		const coach = await authorizeFeatureRequest({ locals: {} }, 'user-1', 'coach');
		expect(coach).toMatchObject({
			allowed: false,
			status: 403,
			code: 'assistant_disabled',
			message: 'Assistant features are disabled for this account.'
		});
		expect(mocks.getPlanAccessForRequest).not.toHaveBeenCalled();

		const memory = await authorizeFeatureRequest({ locals: {} }, 'user-1', 'memory');
		expect(memory).toMatchObject({ allowed: true });
	});

	it('uses the exact common age denial', async () => {
		mocks.getTutorProfileViewForRequest.mockResolvedValue({ ageConfirmedAt: null });
		const result = await authorizeFeatureRequest({ locals: {} }, 'user-1', 'coach');

		expect(result).toEqual({
			allowed: false,
			status: 403,
			code: 'age_required',
			message: 'You must be at least 13 to use Super features.'
		});
	});

	it('returns resolved facts to the implementation', async () => {
		const locals = {};
		const result = await authorizeFeatureRequest({ locals }, 'user-1', 'studyPlans');

		expect(result).toMatchObject({
			allowed: true,
			userId: 'user-1',
			planAccess: { plan: 'super' },
			profile
		});
		expect(mocks.getPlanAccessForRequest).toHaveBeenCalledWith(locals, 'user-1');
		expect(mocks.getTutorProfileViewForRequest).toHaveBeenCalledWith(locals, 'user-1');
	});
});
