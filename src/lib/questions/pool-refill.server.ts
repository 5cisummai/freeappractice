import { randomUUID } from 'node:crypto';
import { generateAndPersistFrq } from '$lib/frq/generation.server';
import {
	PoolGenerationBudget,
	PoolRefillState,
	type IPoolRefillState
} from '$lib/questions/pool-refill-model.server';
import {
	countActivePoolRows,
	type PoolBucketKey
} from '$lib/questions/pool-refill-queue.server';
import { generateQuestionForPool } from '$lib/questions/pool-write.server';
import { connectDb } from '$lib/server/db';
import { QUESTION_POOL_CONFIG, type QuestionPoolConfig } from '$lib/questions/pool-constants';
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
	const [emptyObserved, failedJobs, budgetExhaustedJobs, pendingJobs, oldest] = await Promise.all([
		PoolRefillState.countDocuments({ observedCount: 0 }),
		PoolRefillState.countDocuments({ status: 'failed' }),
		PoolRefillState.countDocuments({ status: 'budget_exhausted' }),
		PoolRefillState.countDocuments({ status: 'pending' }),
		PoolRefillState.findOne({
			status: { $in: ['pending', 'failed', 'budget_exhausted', 'running'] }
		})
			.sort({ requestedAt: 1 })
			.select({ requestedAt: 1 })
			.lean()
	]);

	captureQuestionPoolHealthMetric({
		processed: summary.processed,
		generated: summary.generated,
		skipped_duplicates: summary.skippedDuplicates,
		failed: summary.failed,
		budget_remaining: summary.budgetRemaining,
		stopped_reason: summary.stoppedReason,
		empty_observed_buckets: emptyObserved,
		failed_jobs: failedJobs,
		budget_exhausted_jobs: budgetExhaustedJobs,
		pending_jobs: pendingJobs,
		oldest_job_age_ms: oldest?.requestedAt ? Math.max(0, now - oldest.requestedAt.getTime()) : 0
	});
}

function utcDayKey(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

export async function getDailyBudgetRemaining(env: QuestionPoolConfig): Promise<number> {
	const dayKey = utcDayKey();
	const doc = await PoolGenerationBudget.findOne({ dayKey }).lean();
	const used = doc?.generations ?? 0;
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
	await PoolGenerationBudget.updateOne(
		{ dayKey },
		{ $setOnInsert: { generations: 0 } },
		{ upsert: true }
	).exec();

	const remaining = await getDailyBudgetRemaining(env);
	const toReserve = Math.min(requested, remaining);
	if (toReserve <= 0) return 0;

	const updated = await PoolGenerationBudget.findOneAndUpdate(
		{ dayKey, generations: { $lte: env.dailyLlmGenerationBudget - toReserve } },
		{ $inc: { generations: toReserve } },
		{ new: true }
	).exec();

	if (updated) return toReserve;

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
	await PoolGenerationBudget.updateOne(
		{ dayKey },
		{ $setOnInsert: { generations: 0 } },
		{ upsert: true }
	).exec();

	const updated = await PoolGenerationBudget.findOneAndUpdate(
		{ dayKey, generations: { $lt: env.dailyLlmGenerationBudget } },
		{ $inc: { generations: 1 } },
		{ new: true }
	).exec();
	return updated !== null;
}

/**
 * Refund previously reserved slots (e.g. batch upload failed before OpenAI ran).
 * Never decrements below 0. Returns how many slots were actually returned.
 */
export async function releaseDailyGenerationBudget(amount: number): Promise<number> {
	if (amount <= 0) return 0;
	const dayKey = utcDayKey();

	const updated = await PoolGenerationBudget.findOneAndUpdate(
		{ dayKey, generations: { $gte: amount } },
		{ $inc: { generations: -amount } },
		{ new: true }
	).exec();
	if (updated) return amount;

	// Concurrent refunds or partial counter — drain whatever remains without going negative.
	const doc = await PoolGenerationBudget.findOne({ dayKey }).lean();
	const available = Math.max(0, doc?.generations ?? 0);
	if (available <= 0) return 0;

	const partial = await PoolGenerationBudget.findOneAndUpdate(
		{ dayKey, generations: { $gte: available } },
		{ $inc: { generations: -available } },
		{ new: true }
	).exec();
	return partial ? available : 0;
}

/** Soft headroom so we don't reserve then get killed mid-LLM on Vercel cron. */
function minRemainingMsForGeneration(questionType: 'mcq' | 'frq'): number {
	switch (questionType) {
		case 'frq':
			// High-reasoning FRQ often exceeds 30s; skip rather than burn budget on kill.
			return 35_000;
		case 'mcq':
			return 10_000;
		default: {
			const _exhaustive: never = questionType;
			return _exhaustive;
		}
	}
}

async function renewRefillLease(
	doc: IPoolRefillState,
	leaseTtlMs: number
): Promise<IPoolRefillState> {
	const leaseExpiresAt = new Date(Date.now() + leaseTtlMs);
	const updated = await PoolRefillState.findOneAndUpdate(
		{ _id: doc._id, leaseOwner: doc.leaseOwner },
		{ $set: { leaseExpiresAt } },
		{ new: true }
	).exec();
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
): Promise<IPoolRefillState | null> {
	await connectDb();
	const now = opts.now ?? new Date();
	const leaseExpiresAt = new Date(now.getTime() + opts.leaseTtlMs);

	return PoolRefillState.findOneAndUpdate(
		{
			questionType: bucket.questionType,
			apClass: bucket.apClass,
			unit: bucket.unit,
			status: { $in: ['pending', 'failed', 'budget_exhausted', 'running'] },
			$and: [
				{
					$or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }]
				},
				{
					$or: [
						{ status: { $ne: 'running' } },
						{ leaseExpiresAt: null },
						{ leaseExpiresAt: { $lte: now } }
					]
				}
			]
		},
		{
			$set: {
				status: 'running',
				leaseOwner: opts.owner,
				leaseExpiresAt,
				lastError: null
			},
			$inc: { attempts: 1 }
		},
		{ new: true }
	).exec();
}

async function releaseLeaseSuccess(
	doc: IPoolRefillState,
	observedCount: number,
	generatedDelta: number
): Promise<void> {
	const done = observedCount >= doc.target;
	await PoolRefillState.updateOne(
		{ _id: doc._id, leaseOwner: doc.leaseOwner },
		{
			$set: {
				status: done ? 'idle' : 'pending',
				observedCount,
				leaseOwner: null,
				leaseExpiresAt: null,
				lastError: null,
				lastSuccessAt: new Date(),
				nextAttemptAt: done ? null : new Date(),
				...(done ? {} : { requestedAt: new Date() })
			},
			$inc: { generatedCount: generatedDelta }
		}
	).exec();
}

async function releaseLeaseFailure(
	doc: IPoolRefillState,
	error: unknown,
	env: QuestionPoolConfig,
	status: 'failed' | 'budget_exhausted' = 'failed'
): Promise<void> {
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

	await PoolRefillState.updateOne(
		{ _id: doc._id, leaseOwner: doc.leaseOwner },
		{
			$set: {
				status: nextStatus,
				leaseOwner: null,
				leaseExpiresAt: null,
				lastError: message.slice(0, 2000),
				nextAttemptAt: new Date(Date.now() + backoffMs)
			}
		}
	).exec();
}

async function generateOne(bucket: PoolBucketKey): Promise<{ skippedDuplicate: boolean }> {
	switch (bucket.questionType) {
		case 'mcq': {
			const result = await generateQuestionForPool(bucket.apClass, bucket.unit);
			return { skippedDuplicate: Boolean(result.skippedDuplicate) };
		}
		case 'frq': {
			const result = await generateAndPersistFrq(bucket.apClass, bucket.unit);
			return { skippedDuplicate: Boolean(result.skippedDuplicate) };
		}
		default: {
			const _exhaustive: never = bucket.questionType;
			return _exhaustive;
		}
	}
}

export async function processRefillJob(
	doc: IPoolRefillState,
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
			if (remainingMs < minRemainingMsForGeneration(bucket.questionType)) break;

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

			const result = await generateOne(bucket);
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
	opts?: { owner?: string; startedAt?: number }
): Promise<RefillRunSummary> {
	await connectDb();
	const startedAt = opts?.startedAt ?? Date.now();
	const deadlineMs = startedAt + env.workerTimeBudgetMs;
	const owner = opts?.owner ?? randomUUID();

	// Claim/generate first. Full-catalog reconcile (`bun run pool:reconcile`) is N+1 and
	// belongs to ops — not every 5-minute cron tick.
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
		const candidate = await PoolRefillState.findOne({
			status: { $in: ['pending', 'failed', 'budget_exhausted', 'running'] },
			$and: [
				{ $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }] },
				{
					$or: [
						{ status: { $ne: 'running' } },
						{ leaseExpiresAt: null },
						{ leaseExpiresAt: { $lte: new Date() } }
					]
				}
			]
		})
			.sort({ requestedAt: 1 })
			.exec();

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
