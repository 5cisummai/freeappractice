import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { poolGenerationBudgets, poolRefillStates } from '#lib/server/neon/schema.js';
import type { PoolRefillState as PoolRefillStateRow } from '#lib/question-bank/pool-refill-types.server.js';
import {
	estimatePoolGenerationSlots,
	estimatePoolGenerationSlotsForJobs,
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
	const renewed = await renewRefillLeases([doc], leaseTtlMs);
	const updated = renewed[0];
	if (!updated) {
		throw new Error('Lost refill lease while generating');
	}
	return updated;
}

async function renewRefillLeases(
	docs: PoolRefillStateRow[],
	leaseTtlMs: number
): Promise<PoolRefillStateRow[]> {
	const owned = docs.filter((doc) => doc.leaseOwner);
	if (!owned.length) return [];
	const owner = owned[0]?.leaseOwner;
	if (!owner || owned.some((doc) => doc.leaseOwner !== owner)) {
		const renewed: PoolRefillStateRow[] = [];
		for (const doc of owned) {
			renewed.push(...(await renewRefillLeases([doc], leaseTtlMs)));
		}
		return renewed;
	}
	const leaseExpiresAt = new Date(Date.now() + leaseTtlMs);
	const rows = await getNeonDatabase()
		.update(poolRefillStates)
		.set({ leaseExpiresAt, updatedAt: new Date() })
		.where(
			and(
				inArray(
					poolRefillStates.id,
					owned.map((doc) => doc.id)
				),
				eq(poolRefillStates.leaseOwner, owner)
			)
		)
		.returning();
	return rows as PoolRefillStateRow[];
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

function budgetExhaustedBackoffMs(attempts: number, env: QuestionPoolConfig): number {
	return Math.min(env.retryDelayMs * 2 ** Math.max(0, attempts - 1), 60 * 60_000);
}

async function releaseLeasesBudgetExhausted(
	docs: PoolRefillStateRow[],
	env: QuestionPoolConfig
): Promise<void> {
	if (!docs.length) return;
	const now = new Date();
	await getNeonDatabase().execute(sql`
		UPDATE ${poolRefillStates} AS target
		SET
			status = 'budget_exhausted',
			lease_owner = NULL,
			lease_expires_at = NULL,
			last_error = incoming.error,
			next_attempt_at = incoming."nextAttemptAt",
			updated_at = ${now}
		FROM (
			SELECT *
			FROM jsonb_to_recordset(${JSON.stringify(
				docs.map((doc) => ({
					id: doc.id,
					leaseOwner: doc.leaseOwner,
					error: 'Daily LLM generation budget exhausted',
					nextAttemptAt: new Date(
						now.getTime() + budgetExhaustedBackoffMs(doc.attempts, env)
					).toISOString()
				}))
			)}::jsonb) AS row(
				"id" text,
				"leaseOwner" text,
				"error" text,
				"nextAttemptAt" timestamptz
			)
		) AS incoming
		WHERE target.id = incoming.id
			AND target.lease_owner IS NOT DISTINCT FROM incoming."leaseOwner"
	`);
}

async function generateOne(
	bucket: PoolBucketKey,
	target: number,
	reservedSlots?: number,
	opts?: { skipCapacityLock?: boolean }
): Promise<{ skippedDuplicate: boolean; skippedAtTarget: boolean; generatedCount: number }> {
	const write = () =>
		generatePoolQuestion(bucket.questionType, bucket.course, bucket.unit, target, reservedSlots);
	if (opts?.skipCapacityLock) {
		const value = await write();
		return {
			skippedDuplicate: Boolean(value.skippedDuplicate),
			skippedAtTarget: false,
			generatedCount: value.generatedCount ?? 1
		};
	}
	const guarded = await writePoolBucketBelowTarget(bucket, target, write);
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

type RefillJobResult = {
	generated: number;
	skippedDuplicates: number;
	budgetUsed: number;
	failed: boolean;
	budgetHit: boolean;
	lease: PoolRefillStateRow;
};

export async function processRefillJob(
	doc: PoolRefillStateRow,
	env: QuestionPoolConfig,
	opts: {
		maxGenerations: number;
		deadlineMs: number;
		observedCount?: number;
		initialReservedSlots?: number;
		leaseAlreadyRenewed?: boolean;
		deferLeaseRelease?: boolean;
		skipCapacityLock?: boolean;
	}
): Promise<RefillJobResult> {
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
	let initialReservedSlots = opts.initialReservedSlots;
	const finish = (result: Omit<RefillJobResult, 'lease'>): RefillJobResult => ({
		...result,
		lease
	});
	try {
		while (budgetUsed < opts.maxGenerations) {
			const remainingMs = opts.deadlineMs - Date.now();
			if (remainingMs < getPoolKindAdapter(bucket.questionType).minimumGenerationHeadroomMs) break;

			const currentCount =
				observedCount ??
				(await countActivePoolRowsForServing(bucket.questionType, bucket.course, bucket.unit));
			if (currentCount >= lease.target) {
				if (!opts.deferLeaseRelease) {
					await releaseLeaseSuccess(lease, currentCount, generated);
				}
				return finish({
					generated,
					skippedDuplicates,
					budgetUsed,
					failed: false,
					budgetHit: false
				});
			}

			const requestedSlots =
				initialReservedSlots ??
				(await estimatePoolGenerationSlots(
					bucket.questionType,
					bucket.course,
					bucket.unit,
					lease.target
				));
			if (budgetUsed + requestedSlots > opts.maxGenerations) {
				if (budgetUsed === 0) {
					await releaseLeaseFailure(
						lease,
						new Error('Daily LLM generation budget exhausted'),
						env,
						'budget_exhausted'
					);
					return finish({
						generated,
						skippedDuplicates,
						budgetUsed,
						failed: false,
						budgetHit: true
					});
				}
				break;
			}
			let reservedSlots: number;
			if (initialReservedSlots != null) {
				reservedSlots = initialReservedSlots;
				initialReservedSlots = undefined;
			} else {
				reservedSlots = await reserveDailyGenerationBudget(env, requestedSlots);
				if (reservedSlots < requestedSlots) {
					if (reservedSlots > 0) await releaseDailyGenerationBudget(reservedSlots);
					await releaseLeaseFailure(
						lease,
						new Error('Daily LLM generation budget exhausted'),
						env,
						'budget_exhausted'
					);
					return finish({
						generated,
						skippedDuplicates,
						budgetUsed,
						failed: false,
						budgetHit: true
					});
				}
			}
			reservedSlotsForAttempt = reservedSlots;

			// Keep the lease alive across multi-gen FRQ work (high reasoning latency).
			if (!opts.leaseAlreadyRenewed || budgetUsed > 0) {
				try {
					lease = await renewRefillLease(lease, env.leaseTtlMs);
				} catch (leaseError) {
					await releaseDailyGenerationBudget(reservedSlots);
					reservedSlotsForAttempt = 0;
					throw leaseError;
				}
			}

			const result = await generateOne(bucket, lease.target, reservedSlots, {
				skipCapacityLock: opts.skipCapacityLock
			});
			if (result.skippedAtTarget) {
				await releaseDailyGenerationBudget(reservedSlots);
				reservedSlotsForAttempt = 0;
				if (!opts.deferLeaseRelease) {
					const latestCount = await countActivePoolRowsForServing(
						bucket.questionType,
						bucket.course,
						bucket.unit
					);
					await releaseLeaseSuccess(lease, latestCount, generated);
				}
				return finish({
					generated,
					skippedDuplicates,
					budgetUsed,
					failed: false,
					budgetHit: false
				});
			}
			const consumedSlots = result.skippedDuplicate ? 1 : Math.max(1, result.generatedCount);
			budgetUsed += consumedSlots;
			if (reservedSlots > consumedSlots) {
				await releaseDailyGenerationBudget(reservedSlots - consumedSlots);
			}
			reservedSlotsForAttempt = 0;
			if (result.skippedDuplicate) {
				skippedDuplicates += 1;
				observedCount = currentCount;
			} else {
				generated += result.generatedCount;
				observedCount = currentCount + result.generatedCount;
			}
		}

		if (!opts.deferLeaseRelease) {
			const latestCount = await countActivePoolRowsForServing(
				bucket.questionType,
				bucket.course,
				bucket.unit
			);
			await releaseLeaseSuccess(lease, latestCount, generated);
		}
		return finish({ generated, skippedDuplicates, budgetUsed, failed: false, budgetHit: false });
	} catch (error) {
		if (reservedSlotsForAttempt > 0) await releaseDailyGenerationBudget(reservedSlotsForAttempt);
		logger.error('[pool-refill] generation failed', {
			...bucket,
			error
		});
		await releaseLeaseFailure(lease, error, env);
		return finish({ generated, skippedDuplicates, budgetUsed, failed: true, budgetHit: false });
	}
}

function jobServingKey(job: PoolBucketKey): string {
	return `${job.questionType}\u0000${job.course}\u0000${job.unit}`;
}

async function loadServingCountsForJobs(jobs: PoolRefillStateRow[]): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	const questionTypes = new Set(jobs.map((job) => job.questionType));
	for (const questionType of questionTypes) {
		const byBucket = await countActivePoolRowsForServingByBucket(
			questionType,
			jobs.filter((job) => job.questionType === questionType)
		);
		for (const [bucketKey, count] of byBucket) {
			counts.set(`${questionType}\u0000${bucketKey}`, count);
		}
	}
	return counts;
}

async function releaseLeasesGenerated(
	jobs: Array<{ doc: PoolRefillStateRow; observedCount: number; generatedDelta: number }>
): Promise<void> {
	if (!jobs.length) return;
	const now = new Date();
	await getNeonDatabase().execute(sql`
		UPDATE ${poolRefillStates} AS target
		SET
			status = CASE
				WHEN incoming."observedCount" >= target.target THEN 'idle'
				ELSE 'pending'
			END,
			observed_count = incoming."observedCount",
			lease_owner = NULL,
			lease_expires_at = NULL,
			last_error = NULL,
			last_success_at = ${now},
			next_attempt_at = CASE
				WHEN incoming."observedCount" >= target.target THEN NULL
				ELSE ${now}
			END,
			requested_at = CASE
				WHEN incoming."observedCount" >= target.target THEN incoming."requestedAt"
				ELSE ${now}
			END,
			generated_count = target.generated_count + incoming."generatedDelta",
			updated_at = ${now}
		FROM (
			SELECT *
			FROM jsonb_to_recordset(${JSON.stringify(
				jobs.map(({ doc, observedCount, generatedDelta }) => ({
					id: doc.id,
					leaseOwner: doc.leaseOwner,
					observedCount,
					generatedDelta,
					requestedAt: doc.requestedAt.toISOString()
				}))
			)}::jsonb) AS row(
				"id" text,
				"leaseOwner" text,
				"observedCount" integer,
				"generatedDelta" integer,
				"requestedAt" timestamptz
			)
		) AS incoming
		WHERE target.id = incoming.id
			AND target.lease_owner IS NOT DISTINCT FROM incoming."leaseOwner"
	`);
}

type PreparedDueRefillJob = {
	job: PoolRefillStateRow;
	observedCount: number;
	initialReservedSlots: number;
};

async function allocateDueRefillBudget(
	live: Array<{ job: PoolRefillStateRow; observedCount: number }>,
	env: QuestionPoolConfig,
	budgetRemaining: number
): Promise<PreparedDueRefillJob[]> {
	const slotEstimates = await estimatePoolGenerationSlotsForJobs(live.map(({ job }) => job));
	const wanted = live.reduce(
		(sum, item) => sum + Math.max(1, slotEstimates.get(item.job.id) ?? 1),
		0
	);
	const reserved =
		wanted > 0 ? await reserveDailyGenerationBudget(env, Math.min(wanted, budgetRemaining)) : 0;
	let remaining = reserved;
	const ready: PreparedDueRefillJob[] = [];
	const exhausted: PoolRefillStateRow[] = [];
	for (const item of live) {
		const slots = Math.max(1, slotEstimates.get(item.job.id) ?? 1);
		if (slots > remaining) {
			exhausted.push(item.job);
			continue;
		}
		remaining -= slots;
		ready.push({ ...item, initialReservedSlots: slots });
	}
	if (remaining > 0) await releaseDailyGenerationBudget(remaining);
	if (exhausted.length) await releaseLeasesBudgetExhausted(exhausted, env);
	return ready;
}

/**
 * Batch pre-LLM work only: one lease renew + grouped slot estimates + one budget reserve.
 * The leased cron path generates without per-job write locks; batch collectors still
 * serialize the final persist through `writePoolBucketBelowTarget`.
 */
async function prepareDueRefillJobs(
	due: Array<{ job: PoolRefillStateRow; observedCount: number }>,
	env: QuestionPoolConfig,
	budgetRemaining: number
): Promise<PreparedDueRefillJob[]> {
	if (!due.length) return [];

	const renewed = await renewRefillLeases(
		due.map(({ job }) => job),
		env.leaseTtlMs
	);
	const renewedById = new Map(renewed.map((row) => [row.id, row]));
	const live = due.flatMap((item) => {
		const job = renewedById.get(item.job.id);
		return job ? [{ job, observedCount: item.observedCount }] : [];
	});
	if (!live.length) return [];

	return allocateDueRefillBudget(live, env, budgetRemaining);
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
		const atTarget: Array<{
			doc: PoolRefillStateRow;
			observedCount: number;
			generatedDelta: number;
		}> = [];
		let due: Array<{ job: PoolRefillStateRow; observedCount: number }> = [];
		for (const job of jobs) {
			const observedCount = servingCounts.get(jobServingKey(job)) ?? 0;
			if (observedCount >= job.target)
				atTarget.push({ doc: job, observedCount, generatedDelta: 0 });
			else due.push({ job, observedCount });
		}
		if (atTarget.length) await releaseLeasesGenerated(atTarget);

		const generatedDeltaById = new Map<string, number>();
		while (due.length && budgetRemaining > 0 && Date.now() < deadlineMs) {
			const prepared = await prepareDueRefillJobs(due, env, budgetRemaining);
			if (!prepared.length) {
				due = [];
				break;
			}

			const results = await Promise.allSettled(
				prepared.map(({ job, observedCount, initialReservedSlots }) =>
					processRefillJob(job, env, {
						maxGenerations: initialReservedSlots,
						deadlineMs,
						observedCount,
						initialReservedSlots,
						leaseAlreadyRenewed: true,
						deferLeaseRelease: true,
						skipCapacityLock: true
					})
				)
			);

			const succeeded: PoolRefillStateRow[] = [];
			for (const [index, result] of results.entries()) {
				const preparedJob = prepared[index];
				if (!preparedJob) continue;
				const job = preparedJob.job;
				if (result.status === 'rejected') {
					failed += 1;
					logger.error('[pool-refill] parallel job failed outside worker boundary', {
						error: result.reason
					});
					continue;
				}
				generated += result.value.generated;
				skippedDuplicates += result.value.skippedDuplicates;
				if (result.value.failed || result.value.budgetHit) {
					if (result.value.failed) failed += 1;
					continue;
				}
				succeeded.push(result.value.lease);
				generatedDeltaById.set(
					job.id,
					(generatedDeltaById.get(job.id) ?? 0) + result.value.generated
				);
			}

			if (!succeeded.length) {
				due = [];
				break;
			}

			const latestCounts = await loadServingCountsForJobs(succeeded);
			const finished: Array<{
				doc: PoolRefillStateRow;
				observedCount: number;
				generatedDelta: number;
			}> = [];
			const stillDue: Array<{ job: PoolRefillStateRow; observedCount: number }> = [];
			for (const job of succeeded) {
				const observedCount = latestCounts.get(jobServingKey(job)) ?? 0;
				if (observedCount >= job.target) {
					finished.push({
						doc: job,
						observedCount,
						generatedDelta: generatedDeltaById.get(job.id) ?? 0
					});
					generatedDeltaById.delete(job.id);
				} else {
					stillDue.push({ job, observedCount });
				}
			}
			if (finished.length) await releaseLeasesGenerated(finished);
			due = stillDue;

			budgetRemaining = await getDailyBudgetRemaining(env);
			if (budgetRemaining <= 0) stoppedReason = 'daily_budget';
			else if (Date.now() >= deadlineMs) stoppedReason = 'time_budget';
			else stoppedReason = 'complete';
		}

		if (due.length) {
			await releaseLeasesGenerated(
				due.map(({ job, observedCount }) => ({
					doc: job,
					observedCount,
					generatedDelta: generatedDeltaById.get(job.id) ?? 0
				}))
			);
		}
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
