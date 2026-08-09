import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	connectDb: vi.fn(),
	listUsers: vi.fn(),
	countUserProfiles: vi.fn(),
	getLatestRecentTopics: vi.fn(),
	getGenerationStatsForApi: vi.fn(),
	getQualityDashboardSnapshot: vi.fn()
}));

vi.mock('$lib/auth/server', () => ({ auth: { api: { listUsers: mocks.listUsers } } }));
vi.mock('$lib/server/db', () => ({ connectDb: mocks.connectDb }));
vi.mock('$lib/users/model.server', () => ({ countUserProfiles: mocks.countUserProfiles }));
vi.mock('$lib/questions/recent-topic.server', () => ({
	getLatestRecentTopics: mocks.getLatestRecentTopics
}));
vi.mock('$lib/questions/gen-stats.server', () => ({
	getGenerationStatsForApi: mocks.getGenerationStatsForApi,
	getMcqGenerationCountsByClass: vi.fn(async () => ({}))
}));
vi.mock('$lib/question-quality/dashboard.server', () => ({
	getQualityDashboardSnapshot: mocks.getQualityDashboardSnapshot
}));
vi.mock('$lib/questions/pool-refill-queue.server', () => ({
	listCatalogBuckets: vi.fn(() => []),
	requestPoolRefill: vi.fn(),
	enqueueAllCatalogDeficits: vi.fn()
}));
vi.mock('$lib/questions/pool-refill-model.server', () => ({
	PoolRefillState: { find: vi.fn(() => ({ lean: () => ({ exec: async () => [] }) })) }
}));
vi.mock('$lib/questions/pool-constants', () => ({
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
		mocks.getGenerationStatsForApi.mockResolvedValue({
			totals: { questions: 1, totalQuestionChars: 20 },
			byApClass: { 'AP Biology': 1 },
			byUnit: { 'Unit 1': 1 },
			byClassAndUnit: { 'AP Biology': { 'Unit 1': 1 } }
		});
		mocks.getQualityDashboardSnapshot.mockResolvedValue({
			counts: { unreviewed: 1, awaitingHuman: 0, good: 0, bad: 0, highPriority: 0 },
			model: 'model',
			calibrated: true,
			jobs: [],
			humanQueue: []
		});
	});

	it('loads only user data for the users tab', async () => {
		const result = await getAdminDashboardData({ ...baseOptions, tab: 'users' });

		expect(result.users).toEqual([{ id: 'user-1' }]);
		expect(mocks.listUsers).toHaveBeenCalledOnce();
		expect(mocks.countUserProfiles).not.toHaveBeenCalled();
		expect(mocks.getLatestRecentTopics).not.toHaveBeenCalled();
		expect(mocks.getGenerationStatsForApi).not.toHaveBeenCalled();
		expect(mocks.getQualityDashboardSnapshot).not.toHaveBeenCalled();
	});

	it('loads only generation data for the generation tab', async () => {
		const result = await getAdminDashboardData({ ...baseOptions, tab: 'generation' });

		expect(result.generationOverview.totalQuestions).toBe(1);
		expect(mocks.getGenerationStatsForApi).toHaveBeenCalledOnce();
		expect(mocks.listUsers).not.toHaveBeenCalled();
		expect(mocks.getQualityDashboardSnapshot).not.toHaveBeenCalled();
	});

	it('loads only quality data for the quality tab', async () => {
		const result = await getAdminDashboardData({ ...baseOptions, tab: 'quality' });

		expect(result.quality.counts.unreviewed).toBe(1);
		expect(mocks.getQualityDashboardSnapshot).toHaveBeenCalledOnce();
		expect(mocks.listUsers).not.toHaveBeenCalled();
		expect(mocks.getGenerationStatsForApi).not.toHaveBeenCalled();
	});
});
