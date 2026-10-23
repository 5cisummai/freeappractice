import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { poolGenerationBudgets, poolRefillStates } from '#lib/server/neon/schema.js';
import type { PoolRefillState as PoolRefillStateRow } from '#lib/question-bank/pool-refill-types.server.js';
import {
	estimatePoolGenerationSlots,
	generatePoolQuestion
} from '#lib/question-bank/pool-kind-worker.server.js';
import { getPoolKindAdapter } from '#lib/question-bank/pool-kinds.server.js';
import {
	countActivePoolRowsForServing,
	countActivePoolRowsForServingByBucket,
	getPoolRefillHealthCounts,
	isValidPoolBucket,
	type PoolBucketKey
} from '#lib/question-bank/pool-refill-queue.server.js';
import { writePoolBucketBelowTarget } from '#lib/question-bank/pool-capacity.server.js';
import {
	QUESTION_POOL_CONFIG,
	type QuestionPoolConfig
} from '#lib/question-bank/pool-constants.js';
import { logger } from '#lib/server/logger.js';
import { captureQuestionPoolHealthMetric } from '#lib/server/question-request-metrics.js';

export type { PoolBucketKey };

export type RefillRunSummary = {
	processed: number;
	generated: number;
	skippedDuplicates: number;
	failed: number;
	budgetRemaining: number;
	stoppedReason: 'complete' | 'time_budget' | 'daily_budget' | 'no_work';
};

const MAX_ATTEMPTS = 8;
const MAX_CONCURRENT_REFILL_JOBS = 40;

type ClaimedRefillJobRow = {
	id: string;
	questionType: PoolRefillStateRow['questionType'];
	course: string;
	unit: string;
	status: PoolRefillStateRow['status'];
	target: number;
	observedCount: number;
	requestedAt: Date | string;
	leaseOwner: string | null;
	leaseExpiresAt: Date | string | null;
	attempts: number;
	generatedCount: number;
	lastError: string | null;
	nextAttemptAt: Date | string | null;
	lastSuccessAt: Date | string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
};

function asClaimedRefillJob(row: ClaimedRefillJobRow): PoolRefillStateRow {
	return {
		id: row.id,
		questionType: row.questionType,
		course: row.course,
		unit: row.unit,
		status: row.status,
		target: Number(row.target),
		observedCount: Number(row.observedCount),
		requestedAt: new Date(row.requestedAt),
		leaseOwner: row.leaseOwner,
		leaseExpiresAt: row.leaseExpiresAt ? new Date(row.leaseExpiresAt) : null,
		attempts: Number(row.attempts),
		generatedCount: Number(row.generatedCount),
		lastError: row.lastError,
		nextAttemptAt: row.nextAttemptAt ? new Date(row.nextAttemptAt) : null,
		lastSuccessAt: row.lastSuccessAt ? new Date(row.lastSuccessAt) : null,
		createdAt: new Date(row.createdAt),
		updatedAt: new Date(row.updatedAt)
	};
}

function claimableRefillSql(now: Date, questionType?: PoolBucketKey['questionType']) {
	return sql`
		${questionType ? sql`${poolRefillStates.questionType} = ${questionType}` : sql`true`}
		AND ${poolRefillStates.status} IN ('pending', 'failed', 'budget_exhausted', 'running')
		AND (${poolRefillStates.nextAttemptAt} IS NULL OR ${poolRefillStates.nextAttemptAt} <= ${now})
		AND (
			${poolRefillStates.status} <> 'running'
			OR ${poolRefillStates.leaseExpiresAt} IS NULL
			OR ${poolRefillStates.leaseExpiresAt} <= ${now}
		)
	`;
}

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

	// Concurrent usage raced — fall back to single-slot loop.
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
				eq(poolRefillStates.course, bucket.course),
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
	target: number,
	reservedSlots?: number
): Promise<{ skippedDuplicate: boolean; skippedAtTarget: boolean; generatedCount: number }> {
	const guarded = await writePoolBucketBelowTarget(bucket, target, () =>
		generatePoolQuestion(bucket.questionType, bucket.course, bucket.unit, target, reservedSlots)
	);
	if (guarded.status === 'at_target') {
		return { skippedDuplicate: false, skippedAtTarget: true, generatedCount: 0 };
	}
	return {
		skippedDuplicate: Boolean(guarded.value.skippedDuplicate),
		skippedAtTarget: false,
		generatedCount: guarded.value.generatedCount ?? 1
	};
}

/**
 * Claim up to `limit` due refill jobs in one statement.
 * Sequential SELECT … LIMIT 1 + lease UPDATE loops trip Sentry's N+1 detector
 * once Neon HTTP queries are traced as `db` spans.
 */
async function claimNextRefillJobs(
	questionType: PoolBucketKey['questionType'] | undefined,
	owner: string,
	env: QuestionPoolConfig,
	limit: number
): Promise<PoolRefillStateRow[]> {
	if (limit <= 0) return [];
	const now = new Date();
	const leaseExpiresAt = new Date(now.getTime() + env.leaseTtlMs);
	const result = await getNeonDatabase().execute<ClaimedRefillJobRow>(sql`
		WITH picked AS MATERIALIZED (
			SELECT ${poolRefillStates.id}
			FROM ${poolRefillStates}
			WHERE ${claimableRefillSql(now, questionType)}
			ORDER BY ${poolRefillStates.requestedAt} ASC
			LIMIT ${limit}
			FOR UPDATE SKIP LOCKED
		)
		UPDATE ${poolRefillStates} AS target
		SET
			status = 'running',
			lease_owner = ${owner},
			lease_expires_at = ${leaseExpiresAt},
			last_error = NULL,
			attempts = target.attempts + 1,
			updated_at = ${now}
		FROM picked
		WHERE target.id = picked.id
		RETURNING
			target.id,
			target.question_type AS "questionType",
			target.course,
			target.unit,
			target.status,
			target.target,
			target.observed_count AS "observedCount",
			target.requested_at AS "requestedAt",
			target.lease_owner AS "leaseOwner",
			target.lease_expires_at AS "leaseExpiresAt",
			target.attempts,
			target.generated_count AS "generatedCount",
			target.last_error AS "lastError",
			target.next_attempt_at AS "nextAttemptAt",
			target.last_success_at AS "lastSuccessAt",
			target.created_at AS "createdAt",
			target.updated_at AS "updatedAt"
	`);
	return result.rows.map(asClaimedRefillJob);
}

async function idleInvalidRefillJobs(
	rows: PoolRefillStateRow[]
): Promise<{ valid: PoolRefillStateRow[]; invalidCount: number }> {
	const valid: PoolRefillStateRow[] = [];
	const invalidIds: string[] = [];
	for (const row of rows) {
		if (isValidPoolBucket(row)) valid.push(row);
		else invalidIds.push(row.id);
	}
	if (invalidIds.length > 0) {
		await getNeonDatabase()
			.update(poolRefillStates)
			.set({
				status: 'idle',
				leaseOwner: null,
				leaseExpiresAt: null,
				nextAttemptAt: null,
				lastError: 'Cancelled invalid catalog pool bucket',
				updatedAt: new Date()
			})
			.where(inArray(poolRefillStates.id, invalidIds));
	}
	return { valid, invalidCount: invalidIds.length };
}

export async function processRefillJob(
	doc: PoolRefillStateRow,
	env: QuestionPoolConfig,
	opts: { maxGenerations: number; deadlineMs: number; observedCount?: number }
): Promise<{
	generated: number;
	skippedDuplicates: number;
	budgetUsed: number;
	failed: boolean;
	budgetHit: boolean;
}> {
	let generated = 0;
	let skippedDuplicates = 0;
	let budgetUsed = 0;
	const bucket: PoolBucketKey = {
		questionType: doc.questionType,
		course: doc.course,
		unit: doc.unit
	};

	let lease = doc;
	let reservedSlotsForAttempt = 0;
	let observedCount = opts.observedCount;
	try {
		while (budgetUsed < opts.maxGenerations) {
			const remainingMs = opts.deadlineMs - Date.now();
			if (remainingMs < getPoolKindAdapter(bucket.questionType).minimumGenerationHeadroomMs) break;

			const currentCount =
				observedCount ??
				(await countActivePoolRowsForServing(bucket.questionType, bucket.course, bucket.unit));
			observedCount = undefined;
			if (currentCount >= lease.target) {
				await releaseLeaseSuccess(lease, currentCount, generated);
				return {
					generated,
					skippedDuplicates,
					budgetUsed,
					failed: false,
					budgetHit: false
				};
			}

			const requestedSlots = await estimatePoolGenerationSlots(
				bucket.questionType,
				bucket.course,
				bucket.unit,
				lease.target
			);
			if (budgetUsed + requestedSlots > opts.maxGenerations) {
				if (budgetUsed === 0) {
					await releaseLeaseFailure(
						lease,
						new Error('Daily LLM generation budget exhausted'),
						env,
						'budget_exhausted'
					);
					return { generated, skippedDuplicates, budgetUsed, failed: false, budgetHit: true };
				}
				break;
			}
			const reservedSlots = await reserveDailyGenerationBudget(env, requestedSlots);
			if (reservedSlots < requestedSlots) {
				if (reservedSlots > 0) await releaseDailyGenerationBudget(reservedSlots);
				await releaseLeaseFailure(
					lease,
					new Error('Daily LLM generation budget exhausted'),
					env,
					'budget_exhausted'
				);
				return { generated, skippedDuplicates, budgetUsed, failed: false, budgetHit: true };
			}
			reservedSlotsForAttempt = reservedSlots;

			// Keep the lease alive across multi-gen FRQ work (high reasoning latency).
			try {
				lease = await renewRefillLease(lease, env.leaseTtlMs);
			} catch (leaseError) {
				await releaseDailyGenerationBudget(reservedSlots);
				reservedSlotsForAttempt = 0;
				throw leaseError;
			}

			const result = await generateOne(bucket, lease.target, reservedSlots);
			if (result.skippedAtTarget) {
				await releaseDailyGenerationBudget(reservedSlots);
				reservedSlotsForAttempt = 0;
				const latestCount = await countActivePoolRowsForServing(
					bucket.questionType,
					bucket.course,
					bucket.unit
				);
				await releaseLeaseSuccess(lease, latestCount, generated);
				return {
					generated,
					skippedDuplicates,
					budgetUsed,
					failed: false,
					budgetHit: false
				};
			}
			const consumedSlots = result.skippedDuplicate ? 1 : Math.max(1, result.generatedCount);
			budgetUsed += consumedSlots;
			if (reservedSlots > consumedSlots) {
				await releaseDailyGenerationBudget(reservedSlots - consumedSlots);
			}
			reservedSlotsForAttempt = 0;
			if (result.skippedDuplicate) {
				skippedDuplicates += 1;
			} else {
				generated += result.generatedCount;
			}
		}

		const latestCount = await countActivePoolRowsForServing(
			bucket.questionType,
			bucket.course,
			bucket.unit
		);
		await releaseLeaseSuccess(lease, latestCount, generated);
		return { generated, skippedDuplicates, budgetUsed, failed: false, budgetHit: false };
	} catch (error) {
		if (reservedSlotsForAttempt > 0) await releaseDailyGenerationBudget(reservedSlotsForAttempt);
		logger.error('[pool-refill] generation failed', {
			...bucket,
			error
		});
		await releaseLeaseFailure(lease, error, env);
		return { generated, skippedDuplicates, budgetUsed, failed: true, budgetHit: false };
	}
}

function jobServingKey(job: PoolRefillStateRow): string {
	return `${job.questionType}\u0000${job.course}\u0000${job.unit}`;
}

async function loadServingCountsForJobs(jobs: PoolRefillStateRow[]): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	const questionTypes = new Set(jobs.map((job) => job.questionType));
	for (const questionType of questionTypes) {
		const byBucket = await countActivePoolRowsForServingByBucket(questionType);
		for (const [bucketKey, count] of byBucket) {
			counts.set(`${questionType}\u0000${bucketKey}`, count);
		}
	}
	return counts;
}

async function releaseAtTargetJobs(
	jobs: Array<{ doc: PoolRefillStateRow; observedCount: number }>
): Promise<void> {
	if (!jobs.length) return;
	const now = new Date();
	await getNeonDatabase().execute(sql`
		UPDATE ${poolRefillStates} AS target
		SET
			status = 'idle',
			observed_count = incoming."observedCount",
			lease_owner = NULL,
			lease_expires_at = NULL,
			last_error = NULL,
			last_success_at = ${now},
			next_attempt_at = NULL,
			requested_at = incoming."requestedAt",
			updated_at = ${now}
		FROM (
			SELECT *
			FROM jsonb_to_recordset(${JSON.stringify(
				jobs.map(({ doc, observedCount }) => ({
					id: doc.id,
					leaseOwner: doc.leaseOwner,
					observedCount,
					requestedAt: doc.requestedAt.toISOString()
				}))
			)}::jsonb) AS row(
				"id" text,
				"leaseOwner" text,
				"observedCount" integer,
				"requestedAt" timestamptz
			)
		) AS incoming
		WHERE target.id = incoming.id
			AND target.lease_owner IS NOT DISTINCT FROM incoming."leaseOwner"
	`);
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

	// Claim/generate first. Full-catalog reconcile (`bun run pool:reconcile`) still
	// walks every catalog bucket and belongs to ops — not every scheduled cron run.
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

	// The daily budget is the generation limit. The worker's deadline below remains
	// the serverless safety boundary for a single invocation.
	while (budgetRemaining > 0 && Date.now() < deadlineMs) {
		const claimedRows = await claimNextRefillJobs(
			opts?.questionType,
			owner,
			env,
			MAX_CONCURRENT_REFILL_JOBS
		);
		if (!claimedRows.length) {
			stoppedReason = processed > 0 ? 'complete' : 'no_work';
			break;
		}

		const { valid: jobs, invalidCount } = await idleInvalidRefillJobs(claimedRows);
		processed += jobs.length + invalidCount;
		if (!jobs.length) continue;

		const servingCounts = await loadServingCountsForJobs(jobs);
		const atTarget: Array<{ doc: PoolRefillStateRow; observedCount: number }> = [];
		const due: Array<{ job: PoolRefillStateRow; observedCount: number }> = [];
		for (const job of jobs) {
			const observedCount = servingCounts.get(jobServingKey(job)) ?? 0;
			if (observedCount >= job.target) atTarget.push({ doc: job, observedCount });
			else due.push({ job, observedCount });
		}
		if (atTarget.length) await releaseAtTargetJobs(atTarget);
		if (!due.length) continue;

		const results = await Promise.allSettled(
			due.map(({ job, observedCount }) =>
				processRefillJob(job, env, {
					maxGenerations: budgetRemaining,
					deadlineMs,
					observedCount
				})
			)
		);
		for (const result of results) {
			if (result.status === 'rejected') {
				failed += 1;
				logger.error('[pool-refill] parallel job failed outside worker boundary', {
					error: result.reason
				});
				continue;
			}
			generated += result.value.generated;
			skippedDuplicates += result.value.skippedDuplicates;
			if (result.value.failed) failed += 1;
		}

		budgetRemaining = await getDailyBudgetRemaining(env);
		if (budgetRemaining <= 0) stoppedReason = 'daily_budget';
		else if (Date.now() >= deadlineMs) stoppedReason = 'time_budget';
		else stoppedReason = 'complete';
	}

	if (budgetRemaining <= 0) stoppedReason = 'daily_budget';
	else if (Date.now() >= deadlineMs) stoppedReason = 'time_budget';

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
