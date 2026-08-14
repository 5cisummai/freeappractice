import { and, eq, inArray, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { poolRefillStates } from '$lib/server/neon/schema';
import { getPoolKindAdapter } from '$lib/questions/pool-kinds.server';
import type { PoolRefillQuestionType } from '$lib/questions/pool-refill-types.server';

const OPEN_REFILL_STATUSES = ['pending', 'failed', 'budget_exhausted', 'running'] as const;

/** Count active canonical pool rows without hydrating any question documents. */
export async function countActivePoolRows(
	questionType: PoolRefillQuestionType,
	apClass: string,
	unit: string
): Promise<number> {
	return getPoolKindAdapter(questionType).countActive(apClass, unit);
}

/** Load active counts for every bucket in one grouped query for ops reconciliation. */
export async function countActivePoolRowsByBucket(
	questionType: PoolRefillQuestionType
): Promise<Map<string, number>> {
	return getPoolKindAdapter(questionType).countActiveByBucket();
}

/** Count open refill jobs directly in ops state for scripts and dashboards. */
export async function countOpenPoolRefillJobs(
	questionType?: PoolRefillQuestionType
): Promise<number> {
	const conditions = [inArray(poolRefillStates.status, [...OPEN_REFILL_STATUSES])];
	if (questionType) conditions.push(eq(poolRefillStates.questionType, questionType));

	const [row] = await getNeonDatabase()
		.select({ count: sql<number>`count(*)` })
		.from(poolRefillStates)
		.where(and(...conditions));

	return Number(row?.count ?? 0);
}

export type PoolRefillHealthCounts = {
	emptyObserved: number;
	failedJobs: number;
	budgetExhaustedJobs: number;
	pendingJobs: number;
	oldestRequestedAt: Date | null;
};

/** Read refill health aggregates in one SQL query instead of loading state rows. */
export async function getPoolRefillHealthCounts(): Promise<PoolRefillHealthCounts> {
	const [row] = await getNeonDatabase()
		.select({
			emptyObserved: sql<number>`count(*) filter (where ${poolRefillStates.observedCount} = 0)`,
			failedJobs: sql<number>`count(*) filter (where ${poolRefillStates.status} = 'failed')`,
			budgetExhaustedJobs: sql<number>`count(*) filter (where ${poolRefillStates.status} = 'budget_exhausted')`,
			pendingJobs: sql<number>`count(*) filter (where ${poolRefillStates.status} = 'pending')`,
			oldestRequestedAt: sql<Date | null>`min(${poolRefillStates.requestedAt}) filter (where ${poolRefillStates.status} in ('pending', 'failed', 'budget_exhausted', 'running'))`
		})
		.from(poolRefillStates);

	return {
		emptyObserved: Number(row?.emptyObserved ?? 0),
		failedJobs: Number(row?.failedJobs ?? 0),
		budgetExhaustedJobs: Number(row?.budgetExhaustedJobs ?? 0),
		pendingJobs: Number(row?.pendingJobs ?? 0),
		oldestRequestedAt: row?.oldestRequestedAt ?? null
	};
}
