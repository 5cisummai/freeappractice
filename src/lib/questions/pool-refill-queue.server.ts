import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { getCourses, getUnitsForClass } from '$lib/catalog/ap-classes';
import { getFrqCourseNames } from '$lib/frq/profiles.server';
import { getMcqGenerationCountsByClass } from '$lib/questions/gen-stats.server';
import {
	countActivePoolRows,
	countActivePoolRowsByBucket,
	getPoolRefillHealthCounts
} from '$lib/questions/pool-counts.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { poolRefillStates } from '$lib/server/neon/schema';
import type { PoolRefillQuestionType } from '$lib/questions/pool-refill-types.server';
import {
	QUESTION_POOL_CONFIG,
	isBelowLowWater,
	poolTargetForBucket,
	type QuestionPoolConfig
} from '$lib/questions/pool-constants';

export type PoolBucketKey = {
	questionType: PoolRefillQuestionType;
	apClass: string;
	unit: string;
};

export function listCatalogBuckets(questionType: PoolRefillQuestionType): PoolBucketKey[] {
	const buckets: PoolBucketKey[] = [];
	switch (questionType) {
		case 'mcq': {
			for (const course of getCourses()) {
				for (const unit of getUnitsForClass(course.name)) {
					buckets.push({ questionType: 'mcq', apClass: course.name, unit });
				}
			}
			break;
		}
		case 'frq': {
			for (const apClass of getFrqCourseNames()) {
				for (const unit of getUnitsForClass(apClass)) {
					buckets.push({ questionType: 'frq', apClass, unit });
				}
			}
			break;
		}
		default: {
			const _exhaustive: never = questionType;
			return _exhaustive;
		}
	}
	return buckets;
}

export { countActivePoolRows, countActivePoolRowsByBucket, getPoolRefillHealthCounts };

/**
 * Upsert a refill request for a bucket. Safe to call from request paths (no LLM).
 * Never demotes a live `running` lease to `pending`.
 */
export async function requestPoolRefill(
	bucket: PoolBucketKey,
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG,
	generationCountsByClass?: Record<string, number>,
	observedCountOverride?: number
): Promise<void> {
	const counts =
		generationCountsByClass ??
		(bucket.questionType === 'mcq' ? await getMcqGenerationCountsByClass() : {});
	const target = poolTargetForBucket({
		questionType: bucket.questionType,
		apClass: bucket.apClass,
		generationCountsByClass: counts,
		config: env
	});
	const observedCount =
		observedCountOverride ??
		(await countActivePoolRows(bucket.questionType, bucket.apClass, bucket.unit));
	const now = new Date();
	const key = {
		questionType: bucket.questionType,
		apClass: bucket.apClass,
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
			target: [poolRefillStates.questionType, poolRefillStates.apClass, poolRefillStates.unit],
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
					eq(poolRefillStates.apClass, key.apClass),
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
				eq(poolRefillStates.apClass, key.apClass),
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
	const generationCountsByClass = await getMcqGenerationCountsByClass();
	let reconciled = 0;
	let enqueued = 0;

	for (const questionType of ['mcq', 'frq'] as const) {
		const observedByBucket = await countActivePoolRowsByBucket(questionType);
		for (const bucket of listCatalogBuckets(questionType)) {
			const target = poolTargetForBucket({
				questionType,
				apClass: bucket.apClass,
				generationCountsByClass,
				config: env
			});
			const observedCount = observedByBucket.get(`${bucket.apClass}\u0000${bucket.unit}`) ?? 0;
			reconciled += 1;
			await getNeonDatabase()
				.insert(poolRefillStates)
				.values({
					id: randomUUID(),
					questionType,
					apClass: bucket.apClass,
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
					target: [poolRefillStates.questionType, poolRefillStates.apClass, poolRefillStates.unit],
					set: { target, observedCount, updatedAt: new Date() }
				});

			if (isBelowLowWater(observedCount, target, env.lowWaterRatio)) {
				await requestPoolRefill(bucket, env, generationCountsByClass, observedCount);
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
							eq(poolRefillStates.apClass, bucket.apClass),
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
	const generationCountsByClass = await getMcqGenerationCountsByClass();
	let enqueued = 0;
	for (const questionType of ['mcq', 'frq'] as const) {
		const observedByBucket = await countActivePoolRowsByBucket(questionType);
		for (const bucket of listCatalogBuckets(questionType)) {
			const target = poolTargetForBucket({
				questionType,
				apClass: bucket.apClass,
				generationCountsByClass,
				config: env
			});
			const observedCount = observedByBucket.get(`${bucket.apClass}\u0000${bucket.unit}`) ?? 0;
			if (observedCount < target) {
				await requestPoolRefill(bucket, env, generationCountsByClass, observedCount);
				enqueued += 1;
			}
		}
	}
	return enqueued;
}
