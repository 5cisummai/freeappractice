import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { getMcqGenerationCountsByCourse } from '$lib/question-bank/gen-stats.server';
import { getUnitsForCourse } from '$lib/catalog/ap-courses';
import { frqBucketUnits } from '$lib/question-bank/frq/practice';
import {
	countActivePoolRows,
	countActivePoolRowsByBucket,
	countActivePoolRowsForServing,
	getPoolRefillHealthCounts
} from '$lib/question-bank/pool-counts.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { poolRefillStates } from '$lib/server/neon/schema';
import { getPoolKindAdapter, POOL_QUESTION_TYPES } from '$lib/question-bank/pool-kinds.server';
import type { PoolRefillQuestionType } from '$lib/question-bank/pool-refill-types.server';
import {
	QUESTION_POOL_CONFIG,
	isBelowLowWater,
	type QuestionPoolConfig
} from '$lib/question-bank/pool-constants';

export type PoolBucketKey = {
	questionType: PoolRefillQuestionType;
	course: string;
	unit: string;
};

export class InvalidPoolBucketError extends Error {
	constructor(bucket: Pick<PoolBucketKey, 'course' | 'unit'>) {
		super(`Invalid catalog pool bucket: ${bucket.course} / ${bucket.unit}`);
		this.name = 'InvalidPoolBucketError';
	}
}

export function isValidPoolBucket(
	bucket: Pick<PoolBucketKey, 'course' | 'unit'> & Partial<Pick<PoolBucketKey, 'questionType'>>
): boolean {
	const course = bucket.course.trim();
	const unit = bucket.unit.trim();
	if (bucket.questionType === 'frq') return frqBucketUnits(course).includes(unit);
	return getUnitsForCourse(course).includes(unit);
}

function normalizePoolBucket(bucket: PoolBucketKey): PoolBucketKey {
	return {
		questionType: bucket.questionType,
		course: bucket.course.trim(),
		unit: bucket.unit.trim()
	};
}

export function listCatalogBuckets(questionType: PoolRefillQuestionType): PoolBucketKey[] {
	return getPoolKindAdapter(questionType).listBuckets();
}

export {
	countActivePoolRows,
	countActivePoolRowsByBucket,
	countActivePoolRowsForServing,
	getPoolRefillHealthCounts
};

/**
 * Upsert a refill request for a bucket. Safe to call from request paths (no LLM).
 * Never demotes a live `running` lease to `pending`.
 */
export async function requestPoolRefill(
	bucket: PoolBucketKey,
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG,
	generationCountsByCourse?: Record<string, number>,
	observedCountOverride?: number
): Promise<void> {
	if (!isValidPoolBucket(bucket)) throw new InvalidPoolBucketError(bucket);
	bucket = normalizePoolBucket(bucket);

	const counts =
		generationCountsByCourse ??
		(bucket.questionType === 'mcq' ? await getMcqGenerationCountsByCourse() : {});
	const target = getPoolKindAdapter(bucket.questionType).targetFor({
		course: bucket.course,
		generationCountsByCourse: counts,
		config: env
	});
	const observedCount =
		observedCountOverride ??
		(await countActivePoolRowsForServing(bucket.questionType, bucket.course, bucket.unit));
	const now = new Date();
	const key = {
		questionType: bucket.questionType,
		course: bucket.course,
		unit: bucket.unit
	};

	// Refresh counts only — do not touch status/lease here (stomping a live lease is unsafe).
	await getNeonDatabase()
		.insert(poolRefillStates)
		.values({
			id: randomUUID(),
			...key,
			target,
			observedCount,
			requestedAt: now,
			status: observedCount < target ? 'pending' : 'idle',
			attempts: 0,
			generatedCount: 0,
			leaseOwner: null,
			leaseExpiresAt: null,
			lastError: null,
			nextAttemptAt: observedCount < target ? now : null
		})
		.onConflictDoUpdate({
			target: [poolRefillStates.questionType, poolRefillStates.course, poolRefillStates.unit],
			set: { target, observedCount, requestedAt: now, updatedAt: now }
		});

	if (observedCount < target) {
		// Promote to pending only when not holding a live lease.
		await getNeonDatabase()
			.update(poolRefillStates)
			.set({
				status: 'pending',
				target,
				observedCount,
				requestedAt: now,
				nextAttemptAt: now,
				lastError: null,
				leaseOwner: null,
				leaseExpiresAt: null,
				updatedAt: now
			})
			.where(
				and(
					eq(poolRefillStates.questionType, key.questionType),
					eq(poolRefillStates.course, key.course),
					eq(poolRefillStates.unit, key.unit),
					or(
						inArray(poolRefillStates.status, ['idle', 'failed', 'budget_exhausted', 'pending']),
						and(eq(poolRefillStates.status, 'running'), isNull(poolRefillStates.leaseExpiresAt)),
						and(eq(poolRefillStates.status, 'running'), lte(poolRefillStates.leaseExpiresAt, now))
					)
				)
			);
		return;
	}

	// At/above target: idle only if not actively running with a live lease.
	await getNeonDatabase()
		.update(poolRefillStates)
		.set({
			status: 'idle',
			observedCount,
			target,
			leaseOwner: null,
			leaseExpiresAt: null,
			lastError: null,
			nextAttemptAt: null,
			updatedAt: now
		})
		.where(
			and(
				eq(poolRefillStates.questionType, key.questionType),
				eq(poolRefillStates.course, key.course),
				eq(poolRefillStates.unit, key.unit),
				or(
					inArray(poolRefillStates.status, ['pending', 'failed', 'budget_exhausted']),
					and(eq(poolRefillStates.status, 'running'), isNull(poolRefillStates.leaseExpiresAt)),
					and(eq(poolRefillStates.status, 'running'), lte(poolRefillStates.leaseExpiresAt, now))
				)
			)
		);
}

/**
 * Full-catalog count + enqueue. Expensive (N+1). Use from admin/ops, not every cron tick.
 */
export async function reconcilePoolRefillJobs(
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG
): Promise<{ reconciled: number; enqueued: number }> {
	const generationCountsByCourse = await getMcqGenerationCountsByCourse();
	let reconciled = 0;
	let enqueued = 0;

	for (const questionType of POOL_QUESTION_TYPES) {
		const adapter = getPoolKindAdapter(questionType);
		const observedByBucket = await countActivePoolRowsByBucket(questionType);
		for (const bucket of listCatalogBuckets(questionType)) {
			const target = adapter.targetFor({
				course: bucket.course,
				generationCountsByCourse,
				config: env
			});
			const observedCount = observedByBucket.get(`${bucket.course}\u0000${bucket.unit}`) ?? 0;
			reconciled += 1;
			await getNeonDatabase()
				.insert(poolRefillStates)
				.values({
					id: randomUUID(),
					questionType,
					course: bucket.course,
					unit: bucket.unit,
					target,
					observedCount,
					status: 'idle',
					attempts: 0,
					generatedCount: 0,
					requestedAt: new Date(),
					leaseOwner: null,
					leaseExpiresAt: null
				})
				.onConflictDoUpdate({
					target: [poolRefillStates.questionType, poolRefillStates.course, poolRefillStates.unit],
					set: { target, observedCount, updatedAt: new Date() }
				});

			if (isBelowLowWater(observedCount, target, env.lowWaterRatio)) {
				await requestPoolRefill(bucket, env, generationCountsByCourse, observedCount);
				enqueued += 1;
			} else if (observedCount >= target) {
				const now = new Date();
				await getNeonDatabase()
					.update(poolRefillStates)
					.set({
						status: 'idle',
						leaseOwner: null,
						leaseExpiresAt: null,
						lastError: null,
						nextAttemptAt: null,
						updatedAt: now
					})
					.where(
						and(
							eq(poolRefillStates.questionType, questionType),
							eq(poolRefillStates.course, bucket.course),
							eq(poolRefillStates.unit, bucket.unit),
							or(
								inArray(poolRefillStates.status, ['pending', 'failed', 'budget_exhausted']),
								and(
									eq(poolRefillStates.status, 'running'),
									isNull(poolRefillStates.leaseExpiresAt)
								),
								and(
									eq(poolRefillStates.status, 'running'),
									lte(poolRefillStates.leaseExpiresAt, now)
								)
							)
						)
					);
			}
		}
	}

	return { reconciled, enqueued };
}

/** Enqueue every catalog bucket still below target (post-backfill stage 2). */
export async function enqueueAllCatalogDeficits(
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG
): Promise<number> {
	const generationCountsByCourse = await getMcqGenerationCountsByCourse();
	let enqueued = 0;
	for (const questionType of POOL_QUESTION_TYPES) {
		const adapter = getPoolKindAdapter(questionType);
		const observedByBucket = await countActivePoolRowsByBucket(questionType);
		for (const bucket of listCatalogBuckets(questionType)) {
			const target = adapter.targetFor({
				course: bucket.course,
				generationCountsByCourse,
				config: env
			});
			const observedCount = observedByBucket.get(`${bucket.course}\u0000${bucket.unit}`) ?? 0;
			if (observedCount < target) {
				await requestPoolRefill(bucket, env, generationCountsByCourse, observedCount);
				enqueued += 1;
			}
		}
	}
	return enqueued;
}
