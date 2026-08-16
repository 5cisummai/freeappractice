import { auth } from '$lib/auth/server';
import { QUESTION_POOL_CONFIG, poolTargetForBucket } from '$lib/question-bank/pool-constants';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqQuestions, mcqQuestions, poolRefillStates } from '$lib/server/neon/schema';
import { and, asc, count, eq, inArray, max, min } from 'drizzle-orm';
import {
	listCatalogBuckets,
	requestPoolRefill,
	enqueueAllCatalogDeficits,
	type PoolBucketKey
} from '$lib/question-bank/pool-refill-queue.server';

import type {
	PoolRefillQuestionType,
	PoolRefillState as PoolRefillStateRow,
	PoolRefillStatus
} from '$lib/question-bank/pool-refill-types.server';
import { getMcqGenerationCountsByClass } from '$lib/question-bank/gen-stats.server';
import { getQualityDashboardSnapshot } from '$lib/question-bank/quality/dashboard.server';
import type { QualityDashboardSnapshot } from '$lib/question-bank/quality/types';
import { getSuperAdminOverview } from '$lib/super/admin.server';
import { getAdminUserSuperAccess } from '$lib/super/billing.server';
import type { SuperAdminOverview } from '$lib/super/types';
import { listFeedbackTabForAdmin } from '$lib/feedback/admin.server';
import type {
	AdminTab,
	AdminFeedbackItem,
	AdminUserRow,
	CacheBucketSummary,
	CacheOverview,
	PoolQuestionType,
	PoolRefillStatusUi
} from '$lib/admin/types.js';

/** Rough per-generation USD estimates for admin cost previews (not billing). */
const EST_MCQ_GENERATION_USD = 0.015;
const EST_FRQ_GENERATION_USD = 0.04;

interface AdminDashboardData {
	activeTab: AdminTab;
	users: AdminUserRow[];
	totalUsers: number;
	limit: number;
	offset: number;
	search: string;
	errorMessage: string | null;
	cacheOverview: CacheOverview;
	cacheBuckets: CacheBucketSummary[];
	quality: QualityDashboardSnapshot;
	superOverview: SuperAdminOverview;
	feedback: AdminFeedbackItem[];
	totalFeedback: number;
	totalSidebarFeedback: number;
	totalBugReports: number;
}

type BucketAggRow = {
	bucket: { apClass: string; unit: string };
	total: number;
	oldestCreatedAt?: Date;
	newestCreatedAt?: Date;
};

function normalizeAdminTab(value: string | null): AdminTab {
	return value === 'users' ||
		value === 'cache' ||
		value === 'quality' ||
		value === 'super' ||
		value === 'feedback'
		? value
		: 'users';
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

async function aggregateActiveBuckets(
	questionType: PoolRefillQuestionType
): Promise<Map<string, BucketAggRow>> {
	const map = new Map<string, BucketAggRow>();
	const db = getNeonDatabase();
	const rows =
		questionType === 'mcq'
			? await db
					.select({
						apClass: mcqQuestions.apClass,
						unit: mcqQuestions.unit,
						total: count(),
						oldestCreatedAt: min(mcqQuestions.createdAt),
						newestCreatedAt: max(mcqQuestions.createdAt)
					})
					.from(mcqQuestions)
					.where(eq(mcqQuestions.active, true))
					.groupBy(mcqQuestions.apClass, mcqQuestions.unit)
			: await db
					.select({
						apClass: frqQuestions.apClass,
						unit: frqQuestions.unit,
						total: count(),
						oldestCreatedAt: min(frqQuestions.createdAt),
						newestCreatedAt: max(frqQuestions.createdAt)
					})
					.from(frqQuestions)
					.where(eq(frqQuestions.active, true))
					.groupBy(frqQuestions.apClass, frqQuestions.unit);
	for (const row of rows) {
		const key = `${row.apClass}::${row.unit}`;
		map.set(key, {
			bucket: { apClass: row.apClass, unit: row.unit },
			total: Number(row.total),
			oldestCreatedAt: row.oldestCreatedAt ?? undefined,
			newestCreatedAt: row.newestCreatedAt ?? undefined
		});
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

function summarizePoolOverview(
	buckets: CacheBucketSummary[],
	mcqTarget: number,
	frqTarget: number
): CacheOverview {
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
			(bucket) => bucket.refillStatus === 'failed' || bucket.refillStatus === 'budget_exhausted'
		).length
	};
}

export async function getPoolReadinessSnapshot(): Promise<{
	overview: CacheOverview;
	buckets: CacheBucketSummary[];
}> {
	const env = QUESTION_POOL_CONFIG;
	const generationCountsByClass = await getMcqGenerationCountsByClass();
	const mcqTarget = env.mcqTarget;
	const frqTarget = env.frqTarget;

	const [mcqActive, frqActive, refillStates] = await Promise.all([
		aggregateActiveBuckets('mcq'),
		aggregateActiveBuckets('frq'),
		getNeonDatabase().select().from(poolRefillStates)
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

	for (const state of refillStates as PoolRefillStateRow[]) {
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

/** Retire the oldest active questions in a bucket, then queue its refill. */
export async function retirePoolBucketQuestions(
	bucket: PoolBucketKey,
	quantity: number
): Promise<{ retired: number; enqueued: true }> {
	const table = bucket.questionType === 'mcq' ? mcqQuestions : frqQuestions;
	const db = getNeonDatabase();
	const rows = await db
		.select({ questionId: table.questionId })
		.from(table)
		.where(
			and(eq(table.apClass, bucket.apClass), eq(table.unit, bucket.unit), eq(table.active, true))
		)
		.orderBy(asc(table.createdAt))
		.limit(quantity);
	const questionIds = rows.map((row) => row.questionId);

	if (questionIds.length > 0) {
		await db
			.update(table)
			.set({ active: false, updatedAt: new Date() })
			.where(inArray(table.questionId, questionIds));
	}

	await requestPoolRefill(bucket);
	return { retired: questionIds.length, enqueued: true };
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
	const activeTab = normalizeAdminTab(opts.tab);
	const offset = (opts.page - 1) * opts.limit;
	const listUsers = () =>
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
		});
	const emptyPool = {
		overview: summarizePoolOverview(
			[],
			QUESTION_POOL_CONFIG.mcqTarget,
			QUESTION_POOL_CONFIG.frqTarget
		),
		buckets: [] as CacheBucketSummary[]
	};
	const emptyQuality: QualityDashboardSnapshot = {
		counts: { unreviewed: 0, awaitingHuman: 0, good: 0, bad: 0, highPriority: 0 },
		model: '',
		calibrated: false,
		jobs: [],
		humanQueue: []
	};
	const emptySuper: SuperAdminOverview = {
		activeSubscriptions: 0,
		pastDueSubscriptions: 0,
		activeGrants: 0,
		month: '',
		personalizedMessagesThisMonth: 0,
		subscriptions: [],
		failedCleanupJobs: []
	};

	let users: AdminUserRow[] = [];
	let totalUsers = 0;
	let errorMessage: string | null = null;
	let poolSnapshot = emptyPool;
	let quality = emptyQuality;
	let superOverview = emptySuper;
	let feedback: AdminFeedbackItem[] = [];
	let totalFeedback = 0;
	let totalSidebarFeedback = 0;
	let totalBugReports = 0;

	switch (activeTab) {
		case 'users':
			try {
				const payload = await listUsers();
				const listed = payload.users as AdminUserRow[];
				const superAccess = await getAdminUserSuperAccess(listed.map((user) => user.id));
				users = listed.map((user) => {
					const access = superAccess.get(user.id);
					return {
						...user,
						plan: access?.plan ?? 'free',
						hasAdminGrant: access?.hasAdminGrant ?? false
					};
				});
				totalUsers = payload.total;
			} catch {
				errorMessage = 'Unable to load users right now.';
			}
			break;
		case 'cache':
			try {
				poolSnapshot = await getPoolReadinessSnapshot();
			} catch {
				// Keep the empty snapshot when the pool is temporarily unavailable.
			}
			break;
		case 'quality':
			quality = await getQualityDashboardSnapshot();
			break;
		case 'super':
			try {
				superOverview = await getSuperAdminOverview();
			} catch {
				errorMessage = 'Unable to load Super data right now.';
			}
			break;
		case 'feedback':
			try {
				const feedbackSnapshot = await listFeedbackTabForAdmin(50);
				feedback = feedbackSnapshot.items;
				totalSidebarFeedback = feedbackSnapshot.totalSidebar;
				totalBugReports = feedbackSnapshot.totalBugReports;
				totalFeedback = totalSidebarFeedback + totalBugReports;
			} catch {
				errorMessage = 'Unable to load feedback right now.';
			}
			break;
		default: {
			const _exhaustive: never = activeTab;
			void _exhaustive;
		}
	}

	return {
		activeTab,
		users,
		totalUsers,
		limit: opts.limit,
		offset,
		search: opts.search,
		errorMessage,
		cacheOverview: poolSnapshot.overview,
		cacheBuckets: poolSnapshot.buckets,
		quality,
		superOverview,
		feedback,
		totalFeedback,
		totalSidebarFeedback,
		totalBugReports
	};
}
