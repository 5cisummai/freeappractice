import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	connectDb: vi.fn(),
	isSuperFreeBetaEnabled: vi.fn(),
	billingFind: vi.fn(),
	grantFindOne: vi.fn()
}));

vi.mock('$lib/server/db', () => ({ connectDb: mocks.connectDb }));
vi.mock('$lib/flags', () => ({ isSuperFreeBetaEnabled: mocks.isSuperFreeBetaEnabled }));
vi.mock('$lib/super/models.server', () => ({
	SuperBillingAccess: { find: mocks.billingFind },
	SuperGrant: { findOne: mocks.grantFindOne }
}));

import { getEntitlements } from '$lib/super/entitlements.server';

function query<T>(value: T) {
	return {
		sort: vi.fn().mockReturnThis(),
		lean: vi.fn().mockReturnThis(),
		exec: vi.fn().mockResolvedValue(value)
	};
}

describe('Super entitlements', () => {
	const now = new Date('2026-08-04T12:00:00.000Z');

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
		mocks.grantFindOne.mockReturnValue(query(null));
	});

	it('grants every authenticated user Super access during the free beta', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);

		await expect(getEntitlements('student-1', now)).resolves.toMatchObject({
			plan: 'super',
			accessReason: 'free_beta',
			personalizedTutor: true,
			coach: true,
			aiInsights: true,
			studyPlans: true
		});
		expect(mocks.connectDb).not.toHaveBeenCalled();
	});

	it('does not grant access to an active subscription once its paid period ended', async () => {
		mocks.billingFind.mockReturnValue(
			query([
				{
					status: 'active',
					periodEnd: new Date('2026-08-04T11:59:59.000Z'),
					superEndedAt: undefined
				}
			])
		);

		await expect(getEntitlements('student-1', now)).resolves.toMatchObject({ plan: 'free' });
	});

	it('grants active access for an unexpired paid period and seven-day past-due grace', async () => {
		mocks.billingFind.mockReturnValue(
			query([
				{
					status: 'active',
					periodEnd: new Date('2026-09-01T00:00:00.000Z'),
					superEndedAt: undefined
				}
			])
		);
		await expect(getEntitlements('student-1', now)).resolves.toMatchObject({
			plan: 'super',
			accessReason: 'subscription'
		});

		mocks.billingFind.mockReturnValue(
			query([
				{
					status: 'past_due',
					pastDueSince: new Date('2026-07-30T12:00:00.000Z'),
					superEndedAt: undefined
				}
			])
		);
		await expect(getEntitlements('student-1', now)).resolves.toMatchObject({
			plan: 'super',
			accessReason: 'past_due_grace'
		});
	});
});
