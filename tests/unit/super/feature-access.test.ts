import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isSuperCoachEnabled: vi.fn(),
	isSuperInsightsEnabled: vi.fn(),
	isSuperMemoryEnabled: vi.fn(),
	getPlanAccess: vi.fn(),
	getStripeClient: vi.fn(() => null),
	getTutorProfileView: vi.fn(),
	getAssistantFeaturesEnabledForRequest: vi.fn()
}));

vi.mock('$lib/flags', () => ({
	isSuperCoachEnabled: mocks.isSuperCoachEnabled,
	isSuperInsightsEnabled: mocks.isSuperInsightsEnabled,
	isSuperMemoryEnabled: mocks.isSuperMemoryEnabled
}));
vi.mock('$lib/super/billing.server', () => ({
	getPlanAccess: mocks.getPlanAccess,
	getStripeClient: mocks.getStripeClient
}));
vi.mock('$lib/super/profile.server', () => ({
	getTutorProfileView: mocks.getTutorProfileView
}));
vi.mock('$lib/super/assistant.server', () => ({
	getAssistantFeaturesEnabledForRequest: mocks.getAssistantFeaturesEnabledForRequest
}));

import { authorizeFeatureRequest } from '$lib/super/feature-access.server';

const profile = {
	ageConfirmedAt: '2026-08-04T00:00:00.000Z'
};

describe('authorizeFeatureRequest', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isSuperCoachEnabled.mockResolvedValue(true);
		mocks.isSuperInsightsEnabled.mockResolvedValue(true);
		mocks.isSuperMemoryEnabled.mockResolvedValue(true);
		mocks.getPlanAccess.mockResolvedValue({
			plan: 'super',
			accessReason: 'subscription'
		});
		mocks.getTutorProfileView.mockResolvedValue(profile);
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
		expect(mocks.getPlanAccess).not.toHaveBeenCalled();
	});

	it('denies unpaid access without reading the profile', async () => {
		mocks.getPlanAccess.mockResolvedValue({ plan: 'free', accessReason: null });
		const result = await authorizeFeatureRequest({ locals: {} }, 'user-1', 'aiInsights');

		expect(result).toMatchObject({
			allowed: false,
			status: 403,
			code: 'subscription_required',
			message: 'Super subscription required'
		});
		expect(mocks.getTutorProfileView).not.toHaveBeenCalled();
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
		expect(mocks.getPlanAccess).not.toHaveBeenCalled();

		const memory = await authorizeFeatureRequest({ locals: {} }, 'user-1', 'memory');
		expect(memory).toMatchObject({ allowed: true });
	});

	it('uses the exact common age denial', async () => {
		mocks.getTutorProfileView.mockResolvedValue({ ageConfirmedAt: null });
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
		expect(mocks.getPlanAccess).toHaveBeenCalledWith('user-1');
		expect(mocks.getTutorProfileView).toHaveBeenCalledWith('user-1');
	});
});
