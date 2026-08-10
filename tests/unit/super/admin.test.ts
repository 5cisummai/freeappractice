/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	update: vi.fn(),
	getEntitlements: vi.fn(),
	selectResults: [] as unknown[][]
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select, update: mocks.update })
}));
vi.mock('$lib/super/entitlements.server', () => ({ getEntitlements: mocks.getEntitlements }));

import { getSuperAdminOverview, retrySuperCleanupJob } from '$lib/super/admin.server';

function selectBuilder(result: unknown[]) {
	const builder: any = {
		from: vi.fn(() => builder),
		where: vi.fn(() => builder),
		orderBy: vi.fn(() => builder),
		limit: vi.fn(() => builder),
		groupBy: vi.fn(() => Promise.resolve(result)),
		then: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
			Promise.resolve(result).then(resolve, reject)
	};
	return builder;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.selectResults = [
		[
			{ status: 'active', total: 2 },
			{ status: 'past_due', total: 1 }
		],
		[{ total: 3 }],
		[
			{
				id: 'billing-1',
				userId: 'user-1',
				stripeCustomerId: 'cus_1',
				stripeSubscriptionId: 'sub_1',
				status: 'active',
				periodStart: new Date('2026-08-01T00:00:00Z'),
				periodEnd: new Date('2026-09-01T00:00:00Z'),
				cancelAtPeriodEnd: false,
				pastDueSince: null,
				superEndedAt: null
			}
		],
		[],
		[{ total: 12 }],
		[{ userId: 'user-1', personalizedMessages: 12, updatedAt: new Date('2026-08-04T00:00:00Z') }],
		[
			{
				id: 'job-1',
				userId: 'user-1',
				kind: 'account_delete',
				attempts: 2,
				nextAttemptAt: new Date('2026-08-04T01:00:00Z'),
				lastError: 'Mem0 unavailable',
				createdAt: new Date('2026-08-03T01:00:00Z'),
				updatedAt: new Date('2026-08-04T00:00:00Z')
			}
		]
	];
	mocks.select.mockImplementation(() => selectBuilder(mocks.selectResults.shift() ?? []));
	mocks.getEntitlements.mockResolvedValue({ accessReason: 'subscription' });
	mocks.update.mockImplementation(() => {
		const builder: any = {
			set: vi.fn(() => builder),
			where: vi.fn(() => builder),
			returning: vi.fn(async () => [{ id: 'job-1' }])
		};
		return builder;
	});
});

describe('direct Drizzle Super admin operations', () => {
	it('returns subscription reasons, usage rollups, and failed jobs', async () => {
		const result = await getSuperAdminOverview(new Date('2026-08-04T12:00:00Z'));
		expect(result).toMatchObject({
			activeSubscriptions: 2,
			pastDueSubscriptions: 1,
			activeGrants: 3,
			personalizedMessagesThisMonth: 12,
			subscriptions: [
				{ userId: 'user-1', stripeSubscriptionId: 'sub_1', accessReason: 'subscription' }
			],
			usageRollups: [{ userId: 'user-1', personalizedMessages: 12 }],
			failedCleanupJobs: [{ id: 'job-1', kind: 'account_delete', attempts: 2 }]
		});
	});

	it('retries a valid incomplete cleanup job with a conditional update', async () => {
		expect(await retrySuperCleanupJob('not-an-object-id')).toBe(false);
		expect(await retrySuperCleanupJob('507f1f77bcf86cd799439011')).toBe(true);
		expect(mocks.update).toHaveBeenCalled();
	});
});
