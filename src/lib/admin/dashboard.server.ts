import { auth } from '$lib/auth/server';
import { connectDb } from '$lib/server/db';
import { UserProfile } from '$lib/users/model.server';
import { Question } from '$lib/questions/cache-model.server';
import { CacheMissLock } from '$lib/questions/cache-lock.server';
import { QuestionRecentTopic } from '$lib/questions/recent-topic-model.server';
import { getGenerationStatsForApi } from '$lib/questions/gen-stats.server';
import type {
	AdminTab,
	AdminUserRow,
	CacheBucketSummary,
	CacheLockSnapshot,
	CacheOverview,
	GenerationClassSummary,
	GenerationOverview,
	GenerationUnitSummary,
	RecentTopicSnapshot
} from '$lib/admin/types.js';

interface AdminDashboardData {
	activeTab: AdminTab;
	users: AdminUserRow[];
	totalUsers: number;
	totalUserProfiles: number;
	limit: number;
	offset: number;
	search: string;
	errorMessage: string | null;
	cacheOverview: CacheOverview;
	cacheBuckets: CacheBucketSummary[];
	cacheLocks: CacheLockSnapshot[];
	recentTopics: RecentTopicSnapshot[];
	generationOverview: GenerationOverview;
	generationByClass: GenerationClassSummary[];
	topGeneratedUnits: GenerationUnitSummary[];
}

function getPoolTargetSize(): number {
	return Math.max(1, parseInt(process.env.CACHE_POOL_SIZE ?? '', 10) || 5);
}

function normalizeAdminTab(value: string | null): AdminTab {
	return value === 'users' || value === 'cache' || value === 'generation' ? value : 'overview';
}

function parseLock(key: string, expiresAt: Date | string): CacheLockSnapshot {
	const parts = key.split('::');

	if (parts[0] === 'miss' && parts[1] === 'mcq') {
		return {
			key,
			type: 'miss',
			apClass: parts[2] ?? 'Unknown',
			unit: parts[3] ?? 'Unknown',
			expiresAt
		};
	}

	// Stale keys (e.g. legacy replenish::*) show as other — replenish workers are gone.
	return {
		key,
		type: 'other',
		apClass: parts[0] === 'replenish' ? (parts[2] ?? 'Unknown') : 'Unknown',
		unit: parts[0] === 'replenish' ? (parts[3] ?? 'Unknown') : 'Unknown',
		expiresAt
	};
}

function summarizeGenerationData(stats: Awaited<ReturnType<typeof getGenerationStatsForApi>>): {
	overview: GenerationOverview;
	byClass: GenerationClassSummary[];
	topUnits: GenerationUnitSummary[];
} {
	const totalQuestions = stats.totals.questions;
	const byClass = Object.entries(stats.byApClass)
		.map(([apClass, count]) => ({
			apClass,
			count,
			share: totalQuestions ? Math.round((count / totalQuestions) * 100) : 0
		}))
		.sort((a, b) => b.count - a.count);

	const topUnits = Object.entries(stats.byClassAndUnit)
		.flatMap(([apClass, units]) =>
			Object.entries(units).map(([unit, count]) => ({ apClass, unit, count }))
		)
		.sort((a, b) => b.count - a.count)
		.slice(0, 12);

	return {
		overview: {
			totalQuestions,
			totalQuestionChars: stats.totals.totalQuestionChars,
			apClassesCount: Object.keys(stats.byApClass).length,
			unitsCount: Object.keys(stats.byUnit).length
		},
		byClass,
		topUnits
	};
}

export async function getAdminDashboardData(opts: {
	headers: Headers;
	search: string;
	page: number;
	limit: number;
	tab: string | null;
}): Promise<AdminDashboardData> {
	await connectDb();

	const targetPoolSize = getPoolTargetSize();
	const activeTab = normalizeAdminTab(opts.tab);
	const offset = (opts.page - 1) * opts.limit;
	const now = new Date();

	const [
		usersResult,
		userProfilesResult,
		cacheBucketsResult,
		cacheLocksResult,
		activeLockCountResult,
		activeMissLockCountResult,
		recentTopicsResult,
		generationStatsResult
	] = await Promise.allSettled([
		auth.api.listUsers({
			headers: opts.headers,
			query: {
				limit: opts.limit,
				offset,
				sortBy: 'createdAt',
				sortDirection: 'desc',
				...(opts.search
					? {
							searchValue: opts.search,
							searchField: 'email' as const,
							searchOperator: 'contains' as const
						}
					: {})
			}
		}),
		UserProfile.countDocuments({}).exec(),
		Question.aggregate([
			{
				$group: {
					_id: { apClass: '$apClass', unit: '$unit' },
					total: { $sum: 1 },
					oldestCreatedAt: { $min: '$createdAt' },
					newestCreatedAt: { $max: '$createdAt' }
				}
			},
			{ $sort: { total: -1, '_id.apClass': 1, '_id.unit': 1 } }
		]).exec(),
		CacheMissLock.find({ expiresAt: { $gt: now } })
			.sort({ expiresAt: 1 })
			.limit(12)
			.lean()
			.exec(),
		CacheMissLock.countDocuments({ expiresAt: { $gt: now } }).exec(),
		CacheMissLock.countDocuments({ expiresAt: { $gt: now }, key: /^miss::/ }).exec(),
		QuestionRecentTopic.find({}).sort({ createdAt: -1 }).limit(10).lean().exec(),
		getGenerationStatsForApi()
	]);

	const usersPayload = usersResult.status === 'fulfilled' ? usersResult.value : null;
	const userError = usersResult.status === 'rejected' ? 'Unable to load users right now.' : null;
	const users = (usersPayload?.users ?? []) as AdminUserRow[];
	const totalUsers = usersPayload?.total ?? 0;
	const totalUserProfiles =
		userProfilesResult.status === 'fulfilled' ? userProfilesResult.value : 0;

	const cacheBucketsRaw =
		cacheBucketsResult.status === 'fulfilled'
			? (cacheBucketsResult.value as Array<{
					_id: { apClass: string; unit: string };
					total: number;
					oldestCreatedAt?: Date;
					newestCreatedAt?: Date;
				}>)
			: [];

	const cacheBuckets: CacheBucketSummary[] = cacheBucketsRaw
		.map((bucket) => {
			const fillRatio = Math.min(100, Math.round((bucket.total / targetPoolSize) * 100));
			const health: CacheBucketSummary['health'] =
				bucket.total === 0 ? 'empty' : bucket.total < targetPoolSize ? 'low' : 'healthy';

			return {
				apClass: bucket._id.apClass,
				unit: bucket._id.unit,
				total: bucket.total,
				oldestCreatedAt: bucket.oldestCreatedAt,
				newestCreatedAt: bucket.newestCreatedAt,
				fillRatio,
				health
			};
		})
		.sort((a, b) => {
			const healthRank: Record<CacheBucketSummary['health'], number> = {
				empty: 0,
				low: 1,
				healthy: 2
			};
			if (healthRank[a.health] !== healthRank[b.health]) {
				return healthRank[a.health] - healthRank[b.health];
			}
			return b.total - a.total;
		});

	const cacheLocks =
		cacheLocksResult.status === 'fulfilled'
			? cacheLocksResult.value.map((lock) => parseLock(lock.key, lock.expiresAt))
			: [];

	const activeLockCount =
		activeLockCountResult.status === 'fulfilled' ? activeLockCountResult.value : cacheLocks.length;
	const activeMissLocks =
		activeMissLockCountResult.status === 'fulfilled'
			? activeMissLockCountResult.value
			: cacheLocks.filter((lock) => lock.type === 'miss').length;

	const cacheOverview: CacheOverview = {
		targetPoolSize,
		totalQuestions: cacheBuckets.reduce((sum, bucket) => sum + bucket.total, 0),
		totalBuckets: cacheBuckets.length,
		healthyBuckets: cacheBuckets.filter((bucket) => bucket.health === 'healthy').length,
		underTargetBuckets: cacheBuckets.filter((bucket) => bucket.total < targetPoolSize).length,
		emptyBuckets: cacheBuckets.filter((bucket) => bucket.total === 0).length,
		activeLocks: activeLockCount,
		activeMissLocks
	};

	const recentTopics: RecentTopicSnapshot[] =
		recentTopicsResult.status === 'fulfilled'
			? recentTopicsResult.value.map((topic) => ({
					apClass: topic.apClass,
					unit: topic.unit,
					topicsCovered: topic.topicsCovered,
					createdAt: topic.createdAt
				}))
			: [];

	const generationPayload =
		generationStatsResult.status === 'fulfilled'
			? summarizeGenerationData(generationStatsResult.value)
			: {
					overview: {
						totalQuestions: 0,
						totalQuestionChars: 0,
						apClassesCount: 0,
						unitsCount: 0
					},
					byClass: [],
					topUnits: []
				};

	return {
		activeTab,
		users,
		totalUsers,
		totalUserProfiles,
		limit: opts.limit,
		offset,
		search: opts.search,
		errorMessage: userError,
		cacheOverview,
		cacheBuckets,
		cacheLocks,
		recentTopics,
		generationOverview: generationPayload.overview,
		generationByClass: generationPayload.byClass,
		topGeneratedUnits: generationPayload.topUnits
	};
}
