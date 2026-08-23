/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	update: vi.fn(),
	insert: vi.fn(),
	getPlanAccess: vi.fn(),
	selectResults: [] as unknown[][]
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		select: mocks.select,
		update: mocks.update,
		insert: mocks.insert
	})
}));
vi.mock('$lib/super/billing.server', () => ({ getPlanAccess: mocks.getPlanAccess }));

import {
	getSuperAdminOverview,
	grantIndefiniteSuperToClaimedFreeBetaUsers,
	retrySuperCleanupJob
} from '$lib/super/admin.server';
import { INDEFINITE_SUPER_GRANT_EXPIRES_AT } from '$lib/super/types';

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
		[{ total: 12 }],
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
	mocks.getPlanAccess.mockResolvedValue({ accessReason: 'subscription', plan: 'super' });
	mocks.insert.mockImplementation(() => {
		const builder: any = {
			values: vi.fn(async () => undefined)
		};
		return builder;
	});
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
	it('returns subscription reasons and failed jobs', async () => {
		const result = await getSuperAdminOverview(new Date('2026-08-04T12:00:00Z'));
		expect(result).toMatchObject({
			activeSubscriptions: 2,
			pastDueSubscriptions: 1,
			activeGrants: 3,
			personalizedMessagesThisMonth: 12,
			subscriptions: [
				{ userId: 'user-1', stripeSubscriptionId: 'sub_1', accessReason: 'subscription' }
			],
			failedCleanupJobs: [{ id: 'job-1', kind: 'account_delete', attempts: 2 }]
		});
	});

	it('retries a valid incomplete cleanup job with a conditional update', async () => {
		expect(await retrySuperCleanupJob('not-an-object-id')).toBe(false);
		expect(await retrySuperCleanupJob('507f1f77bcf86cd799439011')).toBe(true);
		expect(mocks.update).toHaveBeenCalled();
	});

	it('grants indefinite Super to claimed free beta users without an existing indefinite grant', async () => {
		mocks.selectResults = [[{ userId: 'beta-1' }, { userId: 'beta-2' }], [{ userId: 'beta-2' }]];
		const insertValues = vi.fn(() => ({
			onConflictDoNothing: () => ({
				returning: async () => [{ userId: 'beta-1' }]
			})
		}));
		mocks.insert.mockImplementation(() => ({ values: insertValues }));

		const result = await grantIndefiniteSuperToClaimedFreeBetaUsers(
			'admin-1',
			new Date('2026-08-12T00:00:00Z')
		);

		expect(result).toEqual({ granted: 1, skipped: 1 });
		expect(insertValues).toHaveBeenCalledWith([
			expect.objectContaining({
				userId: 'beta-1',
				createdBy: 'admin-1',
				expiresAt: new Date(INDEFINITE_SUPER_GRANT_EXPIRES_AT),
				reason: 'Converted free Super beta claim to an indefinite grant'
			})
		]);
	});
});
