import { auth } from '$lib/auth/server';
import { connectDb } from '$lib/server/db';
import { QUESTION_POOL_CONFIG, poolTargetForBucket } from '$lib/questions/pool-constants';
import { UserProfile } from '$lib/users/model.server';
import { Question } from '$lib/questions/cache-model.server';
import { QuestionRecentTopic } from '$lib/questions/recent-topic-model.server';
import { FrqQuestionModel } from '$lib/frq/model.server';
import {
	listCatalogBuckets,
	requestPoolRefill,
	enqueueAllCatalogDeficits,
	type PoolBucketKey
} from '$lib/questions/pool-refill-queue.server';
import {
	PoolRefillState,
	type PoolRefillQuestionType,
	type PoolRefillStatus
} from '$lib/questions/pool-refill-model.server';
import {
	getGenerationStatsForApi,
	getMcqGenerationCountsByClass
} from '$lib/questions/gen-stats.server';
import { getQualityDashboardSnapshot } from '$lib/question-quality/dashboard.server';
import type { QualityDashboardSnapshot } from '$lib/question-quality/types';
import type {
	AdminTab,
	AdminUserRow,
	CacheBucketSummary,
	CacheOverview,
	GenerationClassSummary,
	GenerationOverview,
	GenerationUnitSummary,
	PoolQuestionType,
	PoolRefillStatusUi,
	RecentTopicSnapshot
} from '$lib/admin/types.js';

/** Rough per-generation USD estimates for admin cost previews (not billing). */
const EST_MCQ_GENERATION_USD = 0.015;
const EST_FRQ_GENERATION_USD = 0.04;

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
	recentTopics: RecentTopicSnapshot[];
	generationOverview: GenerationOverview;
	generationByClass: GenerationClassSummary[];
	topGeneratedUnits: GenerationUnitSummary[];
	quality: QualityDashboardSnapshot;
}

type BucketAggRow = {
	_id: { apClass: string; unit: string };
	total: number;
	oldestCreatedAt?: Date;
	newestCreatedAt?: Date;
};

function normalizeAdminTab(value: string | null): AdminTab {
	return value === 'users' || value === 'cache' || value === 'generation' || value === 'quality'
		? value
		: 'overview';
}

function estimateGenerationCostUsd(questionType: PoolQuestionType, deficit: number): number {
	const unitCost = questionType === 'mcq' ? EST_MCQ_GENERATION_USD : EST_FRQ_GENERATION_USD;
	return Math.round(Math.max(0, deficit) * unitCost * 1000) / 1000;
}

function toRefillStatusUi(status: PoolRefillStatus | undefined | null): PoolRefillStatusUi {
	switch (status) {
		case 'pending':
		case 'running':
		case 'idle':
		case 'failed':
		case 'budget_exhausted':
			return status;
		case undefined:
		case null:
			return 'unknown';
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

function healthForCount(activeCount: number, target: number): CacheBucketSummary['health'] {
	if (activeCount <= 0) return 'empty';
	if (activeCount < target) return 'low';
	return 'healthy';
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

async function aggregateActiveBuckets(
	questionType: PoolRefillQuestionType
): Promise<Map<string, BucketAggRow>> {
	const model = questionType === 'mcq' ? Question : FrqQuestionModel;
	const rows = (await model
		.aggregate([
			{ $match: { active: { $ne: false } } },
			{
				$group: {
					_id: { apClass: '$apClass', unit: '$unit' },
					total: { $sum: 1 },
					oldestCreatedAt: { $min: '$createdAt' },
					newestCreatedAt: { $max: '$createdAt' }
				}
			}
		])
		.exec()) as BucketAggRow[];

	const map = new Map<string, BucketAggRow>();
	for (const row of rows) {
		map.set(`${row._id.apClass}::${row._id.unit}`, row);
	}
	return map;
}

function buildPoolBuckets(opts: {
	questionType: PoolQuestionType;
	targetFor: (bucket: PoolBucketKey) => number;
	catalog: PoolBucketKey[];
	activeByKey: Map<string, BucketAggRow>;
	refillByKey: Map<
		string,
		{
			status: PoolRefillStatus;
			lastSuccessAt?: Date | null;
			lastError?: string | null;
			observedCount?: number;
		}
	>;
}): CacheBucketSummary[] {
	return opts.catalog.map((bucket) => {
		const key = `${bucket.apClass}::${bucket.unit}`;
		const active = opts.activeByKey.get(key);
		const refill = opts.refillByKey.get(key);
		const activeCount = active?.total ?? refill?.observedCount ?? 0;
		const target = opts.targetFor(bucket);
		const deficit = Math.max(0, target - activeCount);
		const fillRatio = target ? Math.min(100, Math.round((activeCount / target) * 100)) : 100;

		return {
			questionType: opts.questionType,
			apClass: bucket.apClass,
			unit: bucket.unit,
			total: activeCount,
			activeCount,
			target,
			deficit,
			oldestCreatedAt: active?.oldestCreatedAt ?? null,
			newestCreatedAt: active?.newestCreatedAt ?? null,
			fillRatio,
			health: healthForCount(activeCount, target),
			refillStatus: toRefillStatusUi(refill?.status),
			lastSuccessAt: refill?.lastSuccessAt ?? null,
			lastError: refill?.lastError ?? null,
			estimatedRemainingCostUsd: estimateGenerationCostUsd(opts.questionType, deficit)
		};
	});
}

function summarizePoolOverview(buckets: CacheBucketSummary[], mcqTarget: number, frqTarget: number): CacheOverview {
	const totalActive = buckets.reduce((sum, bucket) => sum + bucket.activeCount, 0);
	const totalTarget = buckets.reduce((sum, bucket) => sum + bucket.target, 0);
	const totalDeficit = buckets.reduce((sum, bucket) => sum + bucket.deficit, 0);
	const filledTowardTarget = buckets.reduce(
		(sum, bucket) => sum + Math.min(bucket.activeCount, bucket.target),
		0
	);
	const readinessPercent = totalTarget
		? Math.min(100, Math.round((filledTowardTarget / totalTarget) * 100))
		: 100;

	return {
		mcqTarget,
		frqTarget,
		targetPoolSize: mcqTarget,
		totalQuestions: totalActive,
		totalTarget,
		totalDeficit,
		readinessPercent,
		estimatedRemainingCostUsd:
			Math.round(
				buckets.reduce((sum, bucket) => sum + bucket.estimatedRemainingCostUsd, 0) * 1000
			) / 1000,
		totalBuckets: buckets.length,
		healthyBuckets: buckets.filter((bucket) => bucket.health === 'healthy').length,
		underTargetBuckets: buckets.filter((bucket) => bucket.deficit > 0).length,
		emptyBuckets: buckets.filter((bucket) => bucket.health === 'empty').length,
		pendingRefills: buckets.filter((bucket) => bucket.refillStatus === 'pending').length,
		runningRefills: buckets.filter((bucket) => bucket.refillStatus === 'running').length,
		failedRefills: buckets.filter(
			(bucket) =>
				bucket.refillStatus === 'failed' || bucket.refillStatus === 'budget_exhausted'
		).length
	};
}

export async function getPoolReadinessSnapshot(): Promise<{
	overview: CacheOverview;
	buckets: CacheBucketSummary[];
}> {
	await connectDb();
	const env = QUESTION_POOL_CONFIG;
	const generationCountsByClass = await getMcqGenerationCountsByClass();
	const mcqTarget = env.mcqTarget;
	const frqTarget = env.frqTarget;

	const [mcqActive, frqActive, refillStates] = await Promise.all([
		aggregateActiveBuckets('mcq'),
		aggregateActiveBuckets('frq'),
		PoolRefillState.find({}).lean().exec()
	]);

	const refillByType = {
		mcq: new Map<
			string,
			{
				status: PoolRefillStatus;
				lastSuccessAt?: Date | null;
				lastError?: string | null;
				observedCount?: number;
			}
		>(),
		frq: new Map<
			string,
			{
				status: PoolRefillStatus;
				lastSuccessAt?: Date | null;
				lastError?: string | null;
				observedCount?: number;
			}
		>()
	};

	for (const state of refillStates) {
		const map = refillByType[state.questionType];
		map.set(`${state.apClass}::${state.unit}`, {
			status: state.status,
			lastSuccessAt: state.lastSuccessAt ?? null,
			lastError: state.lastError ?? null,
			observedCount: state.observedCount
		});
	}

	const buckets = [
		...buildPoolBuckets({
			questionType: 'mcq',
			targetFor: (bucket) =>
				poolTargetForBucket({
					questionType: 'mcq',
					apClass: bucket.apClass,
					generationCountsByClass,
					config: env
				}),
			catalog: listCatalogBuckets('mcq'),
			activeByKey: mcqActive,
			refillByKey: refillByType.mcq
		}),
		...buildPoolBuckets({
			questionType: 'frq',
			targetFor: (bucket) =>
				poolTargetForBucket({
					questionType: 'frq',
					apClass: bucket.apClass,
					config: env
				}),
			catalog: listCatalogBuckets('frq'),
			activeByKey: frqActive,
			refillByKey: refillByType.frq
		})
	].sort((a, b) => {
		const healthRank: Record<CacheBucketSummary['health'], number> = {
			empty: 0,
			low: 1,
			healthy: 2
		};
		if (healthRank[a.health] !== healthRank[b.health]) {
			return healthRank[a.health] - healthRank[b.health];
		}
		if (b.deficit !== a.deficit) return b.deficit - a.deficit;
		if (a.questionType !== b.questionType) return a.questionType.localeCompare(b.questionType);
		if (a.apClass !== b.apClass) return a.apClass.localeCompare(b.apClass);
		return a.unit.localeCompare(b.unit);
	});

	return {
		overview: summarizePoolOverview(buckets, mcqTarget, frqTarget),
		buckets
	};
}

/** Enqueue one bucket for async refill. Never runs LLM generation. */
export async function enqueuePoolBucketRefill(bucket: PoolBucketKey): Promise<{ enqueued: true }> {
	await requestPoolRefill(bucket);
	return { enqueued: true };
}

/** Enqueue every catalog deficit for async refill. Never runs LLM generation. */
export async function enqueueAllPoolDeficits(): Promise<{ enqueued: number }> {
	const enqueued = await enqueueAllCatalogDeficits();
	return { enqueued };
}

export async function getAdminDashboardData(opts: {
	headers: Headers;
	search: string;
	page: number;
	limit: number;
	tab: string | null;
}): Promise<AdminDashboardData> {
	await connectDb();

	const activeTab = normalizeAdminTab(opts.tab);
	const offset = (opts.page - 1) * opts.limit;

	const [
		usersResult,
		userProfilesResult,
		poolSnapshotResult,
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
		getPoolReadinessSnapshot(),
		QuestionRecentTopic.find({}).sort({ createdAt: -1 }).limit(10).lean().exec(),
		getGenerationStatsForApi()
	]);

	const usersPayload = usersResult.status === 'fulfilled' ? usersResult.value : null;
	const userError = usersResult.status === 'rejected' ? 'Unable to load users right now.' : null;
	const users = (usersPayload?.users ?? []) as AdminUserRow[];
	const totalUsers = usersPayload?.total ?? 0;
	const totalUserProfiles =
		userProfilesResult.status === 'fulfilled' ? userProfilesResult.value : 0;

	const poolSnapshot =
		poolSnapshotResult.status === 'fulfilled'
			? poolSnapshotResult.value
			: {
					overview: summarizePoolOverview([], QUESTION_POOL_CONFIG.mcqTarget, QUESTION_POOL_CONFIG.frqTarget),
					buckets: [] as CacheBucketSummary[]
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

	const quality =
		activeTab === 'quality'
			? await getQualityDashboardSnapshot()
			: {
					counts: { unreviewed: 0, awaitingHuman: 0, good: 0, bad: 0, highPriority: 0 },
					model: '',
					calibrated: false,
					jobs: [],
					humanQueue: []
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
		cacheOverview: poolSnapshot.overview,
		cacheBuckets: poolSnapshot.buckets,
		recentTopics,
		generationOverview: generationPayload.overview,
		generationByClass: generationPayload.byClass,
		topGeneratedUnits: generationPayload.topUnits,
		quality
	};
}
