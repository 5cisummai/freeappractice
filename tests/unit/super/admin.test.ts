import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	connectDb: vi.fn(),
	getEntitlements: vi.fn(),
	SuperBillingAccess: {
		countDocuments: vi.fn(),
		find: vi.fn()
	},
	SuperCleanupJob: {
		find: vi.fn(),
		updateOne: vi.fn()
	},
	SuperGrant: {
		find: vi.fn(),
		countDocuments: vi.fn(),
		create: vi.fn(),
		updateOne: vi.fn()
	},
	SuperUsageRollup: {
		aggregate: vi.fn(),
		find: vi.fn()
	}
}));

vi.mock('$lib/server/db', () => ({ connectDb: mocks.connectDb }));
vi.mock('$lib/super/entitlements.server', () => ({
	getEntitlements: mocks.getEntitlements
}));
vi.mock('$lib/super/models.server', () => mocks);

import { getSuperAdminOverview, retrySuperCleanupJob } from '$lib/super/admin.server';

function query<T>(value: T) {
	return {
		sort: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		lean: vi.fn().mockReturnThis(),
		exec: vi.fn().mockResolvedValue(value)
	};
}

describe('Super admin operations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.SuperBillingAccess.countDocuments
			.mockReturnValueOnce(query(2))
			.mockReturnValueOnce(query(1));
		mocks.SuperBillingAccess.find.mockReturnValue(
			query([
				{
					_id: 'billing-1',
					userId: 'user-1',
					stripeCustomerId: 'cus_1',
					stripeSubscriptionId: 'sub_1',
					status: 'active',
					periodStart: new Date('2026-08-01T00:00:00.000Z'),
					periodEnd: new Date('2026-09-01T00:00:00.000Z'),
					cancelAtPeriodEnd: false,
					superEndedAt: undefined
				}
			])
		);
		mocks.SuperGrant.find.mockReturnValue(query([]));
		mocks.SuperGrant.countDocuments.mockReturnValue(query(3));
		mocks.SuperUsageRollup.aggregate.mockReturnValue(query([{ total: 12 }]));
		mocks.SuperUsageRollup.find.mockReturnValue(
			query([
				{
					userId: 'user-1',
					personalizedMessages: 12,
					updatedAt: new Date('2026-08-04T00:00:00.000Z')
				}
			])
		);
		mocks.SuperCleanupJob.find.mockReturnValue(
			query([
				{
					_id: 'job-1',
					userId: 'user-1',
					mem0UserId: 'opaque-mem0-id',
					kind: 'account_delete',
					attempts: 2,
					nextAttemptAt: new Date('2026-08-04T01:00:00.000Z'),
					lastError: 'Mem0 unavailable',
					createdAt: new Date('2026-08-03T01:00:00.000Z'),
					updatedAt: new Date('2026-08-04T00:00:00.000Z')
				}
			])
		);
		mocks.getEntitlements.mockResolvedValue({ accessReason: 'subscription' });
		mocks.SuperCleanupJob.updateOne.mockReturnValue(query({ modifiedCount: 1 }));
	});

	it('returns subscription reasons, Mongo rollups, and failed jobs without Mem0 ids', async () => {
		const result = await getSuperAdminOverview(new Date('2026-08-04T12:00:00.000Z'));

		expect(result).toMatchObject({
			activeSubscriptions: 2,
			pastDueSubscriptions: 1,
			activeGrants: 3,
			personalizedMessagesThisMonth: 12,
			subscriptions: [
				{
					userId: 'user-1',
					stripeSubscriptionId: 'sub_1',
					accessReason: 'subscription'
				}
			],
			usageRollups: [{ userId: 'user-1', personalizedMessages: 12 }],
			failedCleanupJobs: [{ id: 'job-1', userId: 'user-1', kind: 'account_delete', attempts: 2 }]
		});
		expect(JSON.stringify(result)).not.toContain('opaque-mem0-id');
		expect(mocks.getEntitlements).toHaveBeenCalledWith(
			'user-1',
			new Date('2026-08-04T12:00:00.000Z')
		);
	});

	it('only retries an incomplete failed cleanup job', async () => {
		await expect(retrySuperCleanupJob('not-an-object-id')).resolves.toBe(false);
		expect(mocks.SuperCleanupJob.updateOne).not.toHaveBeenCalled();

		await expect(
			retrySuperCleanupJob('507f1f77bcf86cd799439011', new Date('2026-08-04T12:00:00.000Z'))
		).resolves.toBe(true);
		expect(mocks.SuperCleanupJob.updateOne).toHaveBeenCalledWith(
			{
				_id: '507f1f77bcf86cd799439011',
				completedAt: { $exists: false },
				lastError: { $exists: true, $nin: [null, ''] }
			},
			{ $set: { nextAttemptAt: new Date('2026-08-04T12:00:00.000Z') } }
		);
	});
});
