/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	isSuperFreeBetaEnabled: vi.fn(),
	markSuperAccessStarted: vi.fn(),
	select: vi.fn(),
	selectResults: [] as unknown[][]
}));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));
vi.mock('#lib/flags.js', () => ({ isSuperFreeBetaEnabled: mocks.isSuperFreeBetaEnabled }));
vi.mock('#lib/agent/personalization/profile.server.js', () => ({
	markSuperAccessStarted: mocks.markSuperAccessStarted
}));

import { getAdminUserSuperAccess, getPlanAccess } from '#lib/billing/subscriptions.server.js';

function selectBuilder(result: unknown[]) {
	const builder: any = {
		from: vi.fn(() => builder),
		where: vi.fn(() => builder),
		orderBy: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		then: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
			Promise.resolve(result).then(resolve, reject)
	};
	return builder;
}

describe('direct Drizzle plan access', () => {
	const now = new Date('2026-08-04T12:00:00.000Z');

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.selectResults = [];
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
		mocks.markSuperAccessStarted.mockResolvedValue(undefined);
		mocks.select.mockImplementation(() => selectBuilder(mocks.selectResults.shift() ?? []));
	});

	it('does not grant access without a claim, subscription, or grant', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);
		mocks.selectResults.push([], [], []);
		expect(await getPlanAccess('student-1', now)).toMatchObject({
			plan: 'free',
			accessReason: null
		});
		expect(mocks.markSuperAccessStarted).not.toHaveBeenCalled();
	});

	it('grants claimed beta and active subscription access from direct rows', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);
		mocks.selectResults.push([{ userId: 'student-1' }]);
		expect(await getPlanAccess('student-1', now)).toMatchObject({
			plan: 'super',
			accessReason: 'free_beta'
		});

		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
		mocks.selectResults.push(
			[
				{
					status: 'active',
					periodEnd: new Date('2026-09-01T00:00:00.000Z'),
					superEndedAt: null,
					billingIssue: null
				}
			],
			[]
		);
		expect(await getPlanAccess('student-1', now)).toMatchObject({
			plan: 'super',
			accessReason: 'subscription'
		});
	});

	it('does not grant access after a paid period ends', async () => {
		mocks.selectResults.push(
			[
				{
					status: 'active',
					periodEnd: new Date('2026-08-04T11:59:59.000Z'),
					superEndedAt: null,
					billingIssue: null
				}
			],
			[]
		);
		expect(await getPlanAccess('student-1', now)).toMatchObject({ plan: 'free' });
	});

	it.each([
		{ status: 'active', billingIssue: 'payment_failed', grant: false, reason: null },
		{ status: 'trialing', billingIssue: null, grant: false, reason: null },
		{ status: 'past_due', graceAge: 7, grant: false, reason: null },
		{ status: 'past_due', graceAge: 6, grant: false, reason: 'past_due_grace' },
		{ status: 'active', billingIssue: null, grant: true, reason: 'admin_grant' }
	])('applies the same policy to user and admin access: $status ($reason)', async (scenario) => {
		const userId = 'student-1';
		const grants = scenario.grant ? [{ userId }] : [];
		const billing = [
			{
				userId,
				status: scenario.status,
				billingIssue: scenario.billingIssue ?? null,
				superEndedAt: null,
				periodEnd: new Date('2026-09-01T00:00:00Z'),
				pastDueSince: scenario.graceAge
					? new Date(now.getTime() - scenario.graceAge * 86_400_000)
					: null
			}
		];

		mocks.selectResults.push(billing, grants, grants, billing);
		const userAccess = await getPlanAccess(userId, now);
		const adminAccess = await getAdminUserSuperAccess([userId], now);
		expect(userAccess).toEqual({
			plan: scenario.reason ? 'super' : 'free',
			accessReason: scenario.reason
		});
		expect(adminAccess.get(userId)).toEqual({ ...userAccess, hasAdminGrant: scenario.grant });
	});
});
