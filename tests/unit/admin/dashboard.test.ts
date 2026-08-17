import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	connectDb: vi.fn(),
	listUsers: vi.fn(),
	getQualityDashboardSnapshot: vi.fn(),
	getSuperAdminOverview: vi.fn(),
	getAdminUserSuperAccess: vi.fn(),
	listFeedbackTabForAdmin: vi.fn()
}));

vi.mock('$lib/auth/server', () => ({ auth: { api: { listUsers: mocks.listUsers } } }));
vi.mock('$lib/server/db', () => ({ connectDb: mocks.connectDb }));
vi.mock('$lib/question-bank/gen-stats.server', () => ({
	getMcqGenerationCountsByClass: vi.fn(async () => ({}))
}));
vi.mock('$lib/question-bank/quality/dashboard.server', () => ({
	getQualityDashboardSnapshot: mocks.getQualityDashboardSnapshot
}));
vi.mock('$lib/super/admin.server', () => ({
	getSuperAdminOverview: mocks.getSuperAdminOverview
}));
vi.mock('$lib/super/billing.server', () => ({
	getAdminUserSuperAccess: mocks.getAdminUserSuperAccess
}));
vi.mock('$lib/feedback/admin.server', () => ({
	listFeedbackTabForAdmin: mocks.listFeedbackTabForAdmin
}));
vi.mock('$lib/question-bank/pool-refill-queue.server', () => ({
	listCatalogBuckets: vi.fn(() => []),
	requestPoolRefill: vi.fn(),
	enqueueAllCatalogDeficits: vi.fn()
}));
vi.mock('$lib/question-bank/pool-constants', () => ({
	QUESTION_POOL_CONFIG: { mcqTarget: 10, frqTarget: 2 },
	poolTargetForBucket: vi.fn(() => 10)
}));

import { getAdminDashboardData } from '$lib/admin/dashboard.server';

const baseOptions = {
	headers: new Headers(),
	search: '',
	page: 1,
	limit: 25
};

describe('admin dashboard query ownership', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.listUsers.mockResolvedValue({ users: [{ id: 'user-1' }], total: 1 });
		mocks.getAdminUserSuperAccess.mockResolvedValue(
			new Map([['user-1', { plan: 'free', accessReason: null, hasAdminGrant: false }]])
		);
		mocks.getQualityDashboardSnapshot.mockResolvedValue({
			counts: { unreviewed: 1, awaitingHuman: 0, good: 0, bad: 0, highPriority: 0 },
			model: 'model',
			calibrated: true,
			jobs: [],
			humanQueue: []
		});
		mocks.getSuperAdminOverview.mockResolvedValue({
			activeSubscriptions: 2,
			pastDueSubscriptions: 0,
			activeGrants: 0,
			month: '2026-08',
			personalizedMessagesThisMonth: 0,
			subscriptions: [],
			failedCleanupJobs: []
		});
		mocks.listFeedbackTabForAdmin.mockResolvedValue({
			items: [
				{
					id: 'fb-1',
					source: 'sidebar',
					category: 'general',
					message: 'Great app',
					createdAt: '2026-08-16T00:00:00.000Z',
					userEmail: 'user@example.com'
				},
				{
					id: 'bug-1',
					source: 'bug_report',
					title: 'Broken question',
					description: 'Answer key looks wrong',
					severity: 'high',
					createdAt: '2026-08-15T00:00:00.000Z',
					reporterEmail: 'reporter@example.com'
				}
			],
			totalSidebar: 1,
			totalBugReports: 1
		});
	});

	it('loads only user data for the users tab', async () => {
		const result = await getAdminDashboardData({ ...baseOptions, tab: 'users' });

		expect(result.users).toEqual([{ id: 'user-1', plan: 'free', hasAdminGrant: false }]);
		expect(mocks.listUsers).toHaveBeenCalledOnce();
		expect(mocks.getAdminUserSuperAccess).toHaveBeenCalledOnce();
		expect(mocks.getQualityDashboardSnapshot).not.toHaveBeenCalled();
		expect(mocks.getSuperAdminOverview).not.toHaveBeenCalled();
	});

	it('loads only quality data for the quality tab', async () => {
		const result = await getAdminDashboardData({ ...baseOptions, tab: 'quality' });

		expect(result.quality.counts.unreviewed).toBe(1);
		expect(mocks.getQualityDashboardSnapshot).toHaveBeenCalledOnce();
		expect(mocks.listUsers).not.toHaveBeenCalled();
		expect(mocks.getSuperAdminOverview).not.toHaveBeenCalled();
	});

	it('loads only Super data for the Super tab', async () => {
		const result = await getAdminDashboardData({ ...baseOptions, tab: 'super' });

		expect(result.superOverview.activeSubscriptions).toBe(2);
		expect(mocks.getSuperAdminOverview).toHaveBeenCalledOnce();
		expect(mocks.listUsers).not.toHaveBeenCalled();
		expect(mocks.getQualityDashboardSnapshot).not.toHaveBeenCalled();
	});

	it('keeps an empty Super overview when the Super query fails', async () => {
		mocks.getSuperAdminOverview.mockRejectedValue(new Error('db down'));

		const result = await getAdminDashboardData({ ...baseOptions, tab: 'super' });

		expect(result.errorMessage).toBe('Unable to load Super data right now.');
		expect(result.superOverview.activeSubscriptions).toBe(0);
		expect(result.superOverview.subscriptions).toEqual([]);
	});

	it('loads only feedback data for the feedback tab', async () => {
		const result = await getAdminDashboardData({ ...baseOptions, tab: 'feedback' });

		expect(result.feedback).toHaveLength(2);
		expect(result.totalFeedback).toBe(2);
		expect(result.totalSidebarFeedback).toBe(1);
		expect(result.totalBugReports).toBe(1);
		expect(mocks.listFeedbackTabForAdmin).toHaveBeenCalledOnce();
		expect(mocks.listUsers).not.toHaveBeenCalled();
		expect(mocks.getQualityDashboardSnapshot).not.toHaveBeenCalled();
		expect(mocks.getSuperAdminOverview).not.toHaveBeenCalled();
	});
});
