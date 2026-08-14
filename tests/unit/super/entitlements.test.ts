/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	isSuperFreeBetaEnabled: vi.fn(),
	markSuperAccessStarted: vi.fn(),
	select: vi.fn(),
	selectResults: [] as unknown[][]
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));
vi.mock('$lib/flags', () => ({ isSuperFreeBetaEnabled: mocks.isSuperFreeBetaEnabled }));
vi.mock('$lib/super/profile.server', () => ({
	markSuperAccessStarted: mocks.markSuperAccessStarted
}));

import { getEntitlements } from '$lib/super/billing.server';

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

describe('direct Drizzle entitlements', () => {
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
		expect(await getEntitlements('student-1', now)).toMatchObject({
			plan: 'free',
			accessReason: null
		});
		expect(mocks.markSuperAccessStarted).not.toHaveBeenCalled();
	});

	it('grants claimed beta and active subscription access from direct rows', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);
		mocks.selectResults.push([{ userId: 'student-1' }]);
		expect(await getEntitlements('student-1', now)).toMatchObject({
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
		expect(await getEntitlements('student-1', now)).toMatchObject({
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
		expect(await getEntitlements('student-1', now)).toMatchObject({ plan: 'free' });
	});
});
