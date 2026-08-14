import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { poolGenerationBudgets, poolRefillStates } from '$lib/server/neon/schema';
import type { PoolRefillState as PoolRefillStateRow } from '$lib/question-bank/pool-refill-types.server';
import { generatePoolQuestion } from '$lib/question-bank/pool-kind-worker.server';
import { getPoolKindAdapter } from '$lib/question-bank/pool-kinds.server';
import {
	countActivePoolRows,
	getPoolRefillHealthCounts,
	type PoolBucketKey
} from '$lib/question-bank/pool-refill-queue.server';
import { writePoolBucketBelowTarget } from '$lib/question-bank/pool-capacity.server';
import { QUESTION_POOL_CONFIG, type QuestionPoolConfig } from '$lib/question-bank/pool-constants';
import { logger } from '$lib/server/logger';
import { captureQuestionPoolHealthMetric } from '$lib/server/question-request-metrics';

export type { PoolBucketKey };

export type RefillRunSummary = {
	processed: number;
	generated: number;
	skippedDuplicates: number;
	failed: number;
	budgetRemaining: number;
	stoppedReason: 'complete' | 'time_budget' | 'generation_cap' | 'daily_budget' | 'no_work';
};

const MAX_ATTEMPTS = 8;

async function captureRefillHealth(summary: RefillRunSummary): Promise<void> {
	const now = Date.now();
	const health = await getPoolRefillHealthCounts();

	captureQuestionPoolHealthMetric({
		processed: summary.processed,
		generated: summary.generated,
		skipped_duplicates: summary.skippedDuplicates,
		failed: summary.failed,
		budget_remaining: summary.budgetRemaining,
		stopped_reason: summary.stoppedReason,
		empty_observed_buckets: health.emptyObserved,
		failed_jobs: health.failedJobs,
		budget_exhausted_jobs: health.budgetExhaustedJobs,
		pending_jobs: health.pendingJobs,
		oldest_job_age_ms: health.oldestRequestedAt
			? Math.max(0, now - health.oldestRequestedAt.getTime())
			: 0
	});
}

function utcDayKey(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

async function ensureGenerationBudget(dayKey: string): Promise<void> {
	await getNeonDatabase()
		.insert(poolGenerationBudgets)
		.values({ dayKey, generations: 0 })
		.onConflictDoNothing();
}

async function readGenerationBudget(dayKey: string): Promise<number> {
	const rows = await getNeonDatabase()
		.select({ generations: poolGenerationBudgets.generations })
		.from(poolGenerationBudgets)
		.where(eq(poolGenerationBudgets.dayKey, dayKey))
		.limit(1);
	return rows[0]?.generations ?? 0;
}

async function reserveGenerationSlots(
	dayKey: string,
	max: number,
	amount: number
): Promise<boolean> {
	const rows = await getNeonDatabase()
		.update(poolGenerationBudgets)
		.set({ generations: sql`${poolGenerationBudgets.generations} + ${amount}` })
		.where(
			and(eq(poolGenerationBudgets.dayKey, dayKey), lte(poolGenerationBudgets.generations, max))
		)
		.returning({ dayKey: poolGenerationBudgets.dayKey });
	return rows.length > 0;
}

async function releaseGenerationSlots(dayKey: string, amount: number): Promise<boolean> {
	const rows = await getNeonDatabase()
		.update(poolGenerationBudgets)
		.set({ generations: sql`${poolGenerationBudgets.generations} - ${amount}` })
		.where(
			and(eq(poolGenerationBudgets.dayKey, dayKey), gte(poolGenerationBudgets.generations, amount))
		)
		.returning({ dayKey: poolGenerationBudgets.dayKey });
	return rows.length > 0;
}

export async function getDailyBudgetRemaining(env: QuestionPoolConfig): Promise<number> {
	const dayKey = utcDayKey();
	const used = await readGenerationBudget(dayKey);
	return Math.max(0, env.dailyLlmGenerationBudget - used);
}

/**
 * Atomically reserve up to `requested` generation slots against the daily hard cap.
 * Returns how many slots were actually reserved (0 if none left).
 */
export async function reserveDailyGenerationBudget(
	env: QuestionPoolConfig,
	requested: number
): Promise<number> {
	if (requested <= 0) return 0;
	const dayKey = utcDayKey();
	await ensureGenerationBudget(dayKey);

	const remaining = await getDailyBudgetRemaining(env);
	const toReserve = Math.min(requested, remaining);
	if (toReserve <= 0) return 0;

	if (await reserveGenerationSlots(dayKey, env.dailyLlmGenerationBudget - toReserve, toReserve))
		return toReserve;

	// Concurrent reservation raced — fall back to single-slot loop.
	let reserved = 0;
	while (reserved < toReserve) {
		const ok = await tryReserveDailyBudget(env);
		if (!ok) break;
		reserved += 1;
	}
	return reserved;
}

/**
 * Atomically reserve one generation against the daily hard cap.
 * Returns false when the cap is already reached (no overshoot under concurrency).
 */
async function tryReserveDailyBudget(env: QuestionPoolConfig): Promise<boolean> {
	const dayKey = utcDayKey();
	await ensureGenerationBudget(dayKey);
	return reserveGenerationSlots(dayKey, env.dailyLlmGenerationBudget - 1, 1);
}

/**
 * Refund previously reserved slots (e.g. batch upload failed before OpenAI ran).
 * Never decrements below 0. Returns how many slots were actually returned.
 */
export async function releaseDailyGenerationBudget(amount: number): Promise<number> {
	if (amount <= 0) return 0;
	const dayKey = utcDayKey();
	if (await releaseGenerationSlots(dayKey, amount)) return amount;

	// Concurrent refunds or partial counter — drain whatever remains without going negative.
	const available = Math.max(0, await readGenerationBudget(dayKey));
	if (available <= 0) return 0;
	return (await releaseGenerationSlots(dayKey, available)) ? available : 0;
}

async function renewRefillLease(
	doc: PoolRefillStateRow,
	leaseTtlMs: number
): Promise<PoolRefillStateRow> {
	if (!doc.leaseOwner) throw new Error('Refill lease has no owner');
	const leaseExpiresAt = new Date(Date.now() + leaseTtlMs);
	const rows = await getNeonDatabase()
		.update(poolRefillStates)
		.set({ leaseExpiresAt, updatedAt: new Date() })
		.where(and(eq(poolRefillStates.id, doc.id), eq(poolRefillStates.leaseOwner, doc.leaseOwner)))
		.returning();
	const updated = rows[0] as PoolRefillStateRow | undefined;
	if (!updated) {
		throw new Error('Lost refill lease while generating');
	}
	return updated;
}

export async function tryAcquireRefillLease(
	bucket: PoolBucketKey,
	opts: { owner: string; leaseTtlMs: number; now?: Date } = {
		owner: randomUUID(),
		leaseTtlMs: QUESTION_POOL_CONFIG.leaseTtlMs
	}
): Promise<PoolRefillStateRow | null> {
	const now = opts.now ?? new Date();
	const leaseExpiresAt = new Date(now.getTime() + opts.leaseTtlMs);

	const rows = await getNeonDatabase()
		.update(poolRefillStates)
		.set({
			status: 'running',
			leaseOwner: opts.owner,
			leaseExpiresAt,
			lastError: null,
			attempts: sql`${poolRefillStates.attempts} + 1`,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(poolRefillStates.questionType, bucket.questionType),
				eq(poolRefillStates.apClass, bucket.apClass),
				eq(poolRefillStates.unit, bucket.unit),
				or(
					eq(poolRefillStates.status, 'pending'),
					eq(poolRefillStates.status, 'failed'),
					eq(poolRefillStates.status, 'budget_exhausted'),
					eq(poolRefillStates.status, 'running')
				),
				or(isNull(poolRefillStates.nextAttemptAt), lte(poolRefillStates.nextAttemptAt, now)),
				or(
					ne(poolRefillStates.status, 'running'),
					isNull(poolRefillStates.leaseExpiresAt),
					lte(poolRefillStates.leaseExpiresAt, now)
				)
			)
		)
		.returning();
	return (rows[0] as PoolRefillStateRow | undefined) ?? null;
}

async function releaseLeaseSuccess(
	doc: PoolRefillStateRow,
	observedCount: number,
	generatedDelta: number
): Promise<void> {
	if (!doc.leaseOwner) return;
	const done = observedCount >= doc.target;
	await getNeonDatabase()
		.update(poolRefillStates)
		.set({
			status: done ? 'idle' : 'pending',
			observedCount,
			leaseOwner: null,
			leaseExpiresAt: null,
			lastError: null,
			lastSuccessAt: new Date(),
			nextAttemptAt: done ? null : new Date(),
			requestedAt: done ? doc.requestedAt : new Date(),
			generatedCount: sql`${poolRefillStates.generatedCount} + ${generatedDelta}`,
			updatedAt: new Date()
		})
		.where(and(eq(poolRefillStates.id, doc.id), eq(poolRefillStates.leaseOwner, doc.leaseOwner)));
}

async function releaseLeaseFailure(
	doc: PoolRefillStateRow,
	error: unknown,
	env: QuestionPoolConfig,
	status: 'failed' | 'budget_exhausted' = 'failed'
): Promise<void> {
	if (!doc.leaseOwner) return;
	const message = error instanceof Error ? error.message : String(error);
	const attempts = doc.attempts;
	const backoffMs = Math.min(env.retryDelayMs * 2 ** Math.max(0, attempts - 1), 60 * 60_000);
	const permanentlyFailed = attempts >= MAX_ATTEMPTS && status === 'failed';

	let nextStatus: 'failed' | 'pending' | 'budget_exhausted';
	switch (status) {
		case 'budget_exhausted':
			nextStatus = 'budget_exhausted';
			break;
		case 'failed':
			nextStatus = permanentlyFailed ? 'failed' : 'pending';
			break;
		default: {
			const _exhaustive: never = status;
			nextStatus = _exhaustive;
		}
	}

	await getNeonDatabase()
		.update(poolRefillStates)
		.set({
			status: nextStatus,
			leaseOwner: null,
			leaseExpiresAt: null,
			lastError: message.slice(0, 2000),
			nextAttemptAt: new Date(Date.now() + backoffMs),
			updatedAt: new Date()
		})
		.where(and(eq(poolRefillStates.id, doc.id), eq(poolRefillStates.leaseOwner, doc.leaseOwner)));
}

async function generateOne(
	bucket: PoolBucketKey,
	target: number
): Promise<{ skippedDuplicate: boolean; skippedAtTarget: boolean }> {
	const guarded = await writePoolBucketBelowTarget(bucket, target, () =>
		generatePoolQuestion(bucket.questionType, bucket.apClass, bucket.unit)
	);
	if (guarded.status === 'at_target') {
		return { skippedDuplicate: false, skippedAtTarget: true };
	}
	return {
		skippedDuplicate: Boolean(guarded.value.skippedDuplicate),
		skippedAtTarget: false
	};
}

export async function processRefillJob(
	doc: PoolRefillStateRow,
	env: QuestionPoolConfig,
	opts: { maxGenerations: number; deadlineMs: number }
): Promise<{ generated: number; skippedDuplicates: number; failed: boolean; budgetHit: boolean }> {
	let generated = 0;
	let skippedDuplicates = 0;
	const bucket: PoolBucketKey = {
		questionType: doc.questionType,
		apClass: doc.apClass,
		unit: doc.unit
	};

	let lease = doc;
	try {
		while (generated + skippedDuplicates < opts.maxGenerations) {
			const remainingMs = opts.deadlineMs - Date.now();
			if (remainingMs < getPoolKindAdapter(bucket.questionType).minimumGenerationHeadroomMs) break;

			const observedCount = await countActivePoolRows(
				bucket.questionType,
				bucket.apClass,
				bucket.unit
			);
			if (observedCount >= lease.target) {
				await releaseLeaseSuccess(lease, observedCount, generated);
				return { generated, skippedDuplicates, failed: false, budgetHit: false };
			}

			const reserved = await tryReserveDailyBudget(env);
			if (!reserved) {
				await releaseLeaseFailure(
					lease,
					new Error('Daily LLM generation budget exhausted'),
					env,
					'budget_exhausted'
				);
				return { generated, skippedDuplicates, failed: false, budgetHit: true };
			}

			// Keep the lease alive across multi-gen FRQ work (high reasoning latency).
			try {
				lease = await renewRefillLease(lease, env.leaseTtlMs);
			} catch (leaseError) {
				await releaseDailyGenerationBudget(1);
				throw leaseError;
			}

			const result = await generateOne(bucket, lease.target);
			if (result.skippedAtTarget) {
				await releaseDailyGenerationBudget(1);
				const latestCount = await countActivePoolRows(
					bucket.questionType,
					bucket.apClass,
					bucket.unit
				);
				await releaseLeaseSuccess(lease, latestCount, generated);
				return { generated, skippedDuplicates, failed: false, budgetHit: false };
			}
			if (result.skippedDuplicate) {
				skippedDuplicates += 1;
			} else {
				generated += 1;
			}
		}

		const observedCount = await countActivePoolRows(
			bucket.questionType,
			bucket.apClass,
			bucket.unit
		);
		await releaseLeaseSuccess(lease, observedCount, generated);
		return { generated, skippedDuplicates, failed: false, budgetHit: false };
	} catch (error) {
		logger.error('[pool-refill] generation failed', {
			...bucket,
			error
		});
		await releaseLeaseFailure(lease, error, env);
		return { generated, skippedDuplicates, failed: true, budgetHit: false };
	}
}

export async function runQuestionPoolRefillWorker(
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG,
	opts?: {
		owner?: string;
		startedAt?: number;
		questionType?: PoolBucketKey['questionType'];
	}
): Promise<RefillRunSummary> {
	const startedAt = opts?.startedAt ?? Date.now();
	const deadlineMs = startedAt + env.workerTimeBudgetMs;
	const owner = opts?.owner ?? randomUUID();

	// Claim/generate first. Full-catalog reconcile (`bun run pool:reconcile`) is N+1 and
	// belongs to ops — not every scheduled cron run.
	let processed = 0;
	let generated = 0;
	let skippedDuplicates = 0;
	let failed = 0;
	let stoppedReason: RefillRunSummary['stoppedReason'] = 'no_work';

	let budgetRemaining = await getDailyBudgetRemaining(env);
	if (budgetRemaining <= 0) {
		const summary: RefillRunSummary = {
			processed,
			generated,
			skippedDuplicates,
			failed,
			budgetRemaining: 0,
			stoppedReason: 'daily_budget'
		};
		await captureRefillHealth(summary);
		return summary;
	}

	let generationsLeft = Math.min(env.maxGenerationsPerRun, budgetRemaining);

	while (generationsLeft > 0 && Date.now() < deadlineMs) {
		const now = new Date();
		const candidateRows = await getNeonDatabase()
			.select()
			.from(poolRefillStates)
			.where(
				and(
					opts?.questionType ? eq(poolRefillStates.questionType, opts.questionType) : sql`true`,
					or(
						eq(poolRefillStates.status, 'pending'),
						eq(poolRefillStates.status, 'failed'),
						eq(poolRefillStates.status, 'budget_exhausted'),
						eq(poolRefillStates.status, 'running')
					),
					or(isNull(poolRefillStates.nextAttemptAt), lte(poolRefillStates.nextAttemptAt, now)),
					or(
						ne(poolRefillStates.status, 'running'),
						isNull(poolRefillStates.leaseExpiresAt),
						lte(poolRefillStates.leaseExpiresAt, now)
					)
				)
			)
			.orderBy(asc(poolRefillStates.requestedAt))
			.limit(1);
		const candidate = candidateRows[0] as PoolRefillStateRow | undefined;

		if (!candidate) {
			stoppedReason = processed > 0 ? 'complete' : 'no_work';
			break;
		}

		const leased = await tryAcquireRefillLease(
			{
				questionType: candidate.questionType,
				apClass: candidate.apClass,
				unit: candidate.unit
			},
			{ owner, leaseTtlMs: env.leaseTtlMs }
		);
		if (!leased) continue;

		processed += 1;
		const result = await processRefillJob(leased, env, {
			maxGenerations: generationsLeft,
			deadlineMs
		});
		generated += result.generated;
		skippedDuplicates += result.skippedDuplicates;
		if (result.failed) failed += 1;
		generationsLeft -= result.generated + result.skippedDuplicates;
		budgetRemaining = await getDailyBudgetRemaining(env);

		if (result.budgetHit || budgetRemaining <= 0) {
			stoppedReason = 'daily_budget';
			break;
		}
		if (Date.now() >= deadlineMs) {
			stoppedReason = 'time_budget';
			break;
		}
		if (generationsLeft <= 0) {
			stoppedReason = 'generation_cap';
			break;
		}
		stoppedReason = 'complete';
	}

	const summary: RefillRunSummary = {
		processed,
		generated,
		skippedDuplicates,
		failed,
		budgetRemaining,
		stoppedReason
	};
	await captureRefillHealth(summary);
	return summary;
}
