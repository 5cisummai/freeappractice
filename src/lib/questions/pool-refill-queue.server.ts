import { getCourses, getUnitsForClass } from '$lib/catalog/ap-classes';
import { getFrqCourseNames } from '$lib/frq/profiles.server';
import { FrqQuestionModel } from '$lib/frq/model.server';
import { Question } from '$lib/questions/cache-model.server';
import { getMcqGenerationCountsByClass } from '$lib/questions/gen-stats.server';
import {
	PoolRefillState,
	type PoolRefillQuestionType
} from '$lib/questions/pool-refill-model.server';
import { connectDb } from '$lib/server/db';
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

export async function countActivePoolRows(
	questionType: PoolRefillQuestionType,
	apClass: string,
	unit: string
): Promise<number> {
	const filter = { apClass, unit, active: { $ne: false } };
	switch (questionType) {
		case 'mcq':
			return Question.countDocuments(filter);
		case 'frq':
			return FrqQuestionModel.countDocuments(filter);
		default: {
			const _exhaustive: never = questionType;
			return _exhaustive;
		}
	}
}

/**
 * Upsert a refill request for a bucket. Safe to call from request paths (no LLM).
 * Never demotes a live `running` lease to `pending`.
 */
export async function requestPoolRefill(
	bucket: PoolBucketKey,
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG,
	generationCountsByClass?: Record<string, number>
): Promise<void> {
	await connectDb();
	const counts =
		generationCountsByClass ??
		(bucket.questionType === 'mcq' ? await getMcqGenerationCountsByClass() : {});
	const target = poolTargetForBucket({
		questionType: bucket.questionType,
		apClass: bucket.apClass,
		generationCountsByClass: counts,
		config: env
	});
	const observedCount = await countActivePoolRows(bucket.questionType, bucket.apClass, bucket.unit);
	const now = new Date();
	const key = {
		questionType: bucket.questionType,
		apClass: bucket.apClass,
		unit: bucket.unit
	};

	// Refresh counts only — do not touch status/lease here (stomping a live lease is unsafe).
	await PoolRefillState.findOneAndUpdate(
		key,
		{
			$set: {
				target,
				observedCount,
				requestedAt: now
			},
			$setOnInsert: {
				status: observedCount < target ? ('pending' as const) : ('idle' as const),
				attempts: 0,
				generatedCount: 0,
				leaseOwner: null,
				leaseExpiresAt: null,
				lastError: null,
				nextAttemptAt: observedCount < target ? now : null
			}
		},
		{ upsert: true }
	).exec();

	if (observedCount < target) {
		// Promote to pending only when not holding a live lease.
		await PoolRefillState.updateOne(
			{
				...key,
				$or: [
					{ status: { $in: ['idle', 'failed', 'budget_exhausted', 'pending'] } },
					{ status: 'running', leaseExpiresAt: null },
					{ status: 'running', leaseExpiresAt: { $lte: now } }
				]
			},
			{
				$set: {
					status: 'pending',
					target,
					observedCount,
					requestedAt: now,
					nextAttemptAt: now,
					lastError: null,
					leaseOwner: null,
					leaseExpiresAt: null
				}
			}
		).exec();
		return;
	}

	// At/above target: idle only if not actively running with a live lease.
	await PoolRefillState.updateOne(
		{
			...key,
			status: { $in: ['pending', 'failed', 'budget_exhausted'] },
			$or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lte: now } }]
		},
		{
			$set: {
				status: 'idle',
				observedCount,
				target,
				leaseOwner: null,
				leaseExpiresAt: null,
				lastError: null,
				nextAttemptAt: null
			}
		}
	).exec();
}

/**
 * Full-catalog count + enqueue. Expensive (N+1). Use from admin/ops, not every cron tick.
 */
export async function reconcilePoolRefillJobs(
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG
): Promise<{ reconciled: number; enqueued: number }> {
	await connectDb();
	const generationCountsByClass = await getMcqGenerationCountsByClass();
	let reconciled = 0;
	let enqueued = 0;

	for (const questionType of ['mcq', 'frq'] as const) {
		for (const bucket of listCatalogBuckets(questionType)) {
			const target = poolTargetForBucket({
				questionType,
				apClass: bucket.apClass,
				generationCountsByClass,
				config: env
			});
			const observedCount = await countActivePoolRows(questionType, bucket.apClass, bucket.unit);
			reconciled += 1;
			await PoolRefillState.findOneAndUpdate(
				{
					questionType,
					apClass: bucket.apClass,
					unit: bucket.unit
				},
				{
					$set: { target, observedCount },
					$setOnInsert: {
						status: 'idle',
						attempts: 0,
						generatedCount: 0,
						requestedAt: new Date(),
						leaseOwner: null,
						leaseExpiresAt: null
					}
				},
				{ upsert: true }
			).exec();

			if (isBelowLowWater(observedCount, target, env.lowWaterRatio)) {
				await requestPoolRefill(bucket, env, generationCountsByClass);
				enqueued += 1;
			} else if (observedCount >= target) {
				const now = new Date();
				await PoolRefillState.updateOne(
					{
						questionType,
						apClass: bucket.apClass,
						unit: bucket.unit,
						status: { $in: ['pending', 'failed', 'budget_exhausted'] },
						$or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lte: now } }]
					},
					{
						$set: {
							status: 'idle',
							leaseOwner: null,
							leaseExpiresAt: null,
							lastError: null,
							nextAttemptAt: null
						}
					}
				).exec();
			}
		}
	}

	return { reconciled, enqueued };
}

/** Enqueue every catalog bucket still below target (post-backfill stage 2). */
export async function enqueueAllCatalogDeficits(
	env: QuestionPoolConfig = QUESTION_POOL_CONFIG
): Promise<number> {
	await connectDb();
	const generationCountsByClass = await getMcqGenerationCountsByClass();
	let enqueued = 0;
	for (const questionType of ['mcq', 'frq'] as const) {
		for (const bucket of listCatalogBuckets(questionType)) {
			const target = poolTargetForBucket({
				questionType,
				apClass: bucket.apClass,
				generationCountsByClass,
				config: env
			});
			const observedCount = await countActivePoolRows(questionType, bucket.apClass, bucket.unit);
			if (observedCount < target) {
				await requestPoolRefill(bucket, env, generationCountsByClass);
				enqueued += 1;
			}
		}
	}
	return enqueued;
}
