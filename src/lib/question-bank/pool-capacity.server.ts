import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { poolBucketWriteLocks } from '$lib/server/neon/schema';
import {
	countActivePoolRowsForServing,
	type PoolBucketKey
} from '$lib/question-bank/pool-refill-queue.server';
import { isDuplicateKeyError } from '$lib/question-bank/util.server';

const LOCK_TTL_MS = 120_000;
const LOCK_RETRY_MS = 50;
const LOCK_ATTEMPTS = 200;

type CapacityResult<T> =
	{ status: 'written'; value: T } | { status: 'at_target'; activeCount: number };

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serialize the final target check and write for one class/unit bucket.
 * Every LLM refill and batch collector uses this guard, so concurrent writers
 * cannot both claim the final slot below a JSON target.
 */
export async function writePoolBucketBelowTarget<T>(
	bucket: PoolBucketKey,
	target: number,
	write: () => Promise<T>
): Promise<CapacityResult<T>> {
	const key = {
		questionType: bucket.questionType,
		apClass: bucket.apClass,
		unit: bucket.unit
	};
	const owner = randomUUID();
	const db = getNeonDatabase();
	try {
		await db
			.insert(poolBucketWriteLocks)
			.values({ id: randomUUID(), ...key, leaseOwner: null, leaseExpiresAt: null })
			.onConflictDoNothing();
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
	}

	let acquired = false;
	for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
		const now = new Date();
		const lock = await db
			.update(poolBucketWriteLocks)
			.set({ leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + LOCK_TTL_MS) })
			.where(
				and(
					eq(poolBucketWriteLocks.questionType, key.questionType),
					eq(poolBucketWriteLocks.apClass, key.apClass),
					eq(poolBucketWriteLocks.unit, key.unit),
					or(
						isNull(poolBucketWriteLocks.leaseOwner),
						isNull(poolBucketWriteLocks.leaseExpiresAt),
						lte(poolBucketWriteLocks.leaseExpiresAt, now)
					)
				)
			)
			.returning({ id: poolBucketWriteLocks.id });
		if (lock.length) {
			acquired = true;
			break;
		}
		await delay(LOCK_RETRY_MS);
	}

	if (!acquired)
		throw new Error(`Timed out waiting for the ${bucket.questionType} pool write lock`);

	try {
		const activeCount = await countActivePoolRowsForServing(
			bucket.questionType,
			bucket.apClass,
			bucket.unit
		);
		if (activeCount >= target) return { status: 'at_target', activeCount };
		return { status: 'written', value: await write() };
	} finally {
		await db
			.update(poolBucketWriteLocks)
			.set({ leaseOwner: null, leaseExpiresAt: null })
			.where(
				and(
					eq(poolBucketWriteLocks.questionType, key.questionType),
					eq(poolBucketWriteLocks.apClass, key.apClass),
					eq(poolBucketWriteLocks.unit, key.unit),
					eq(poolBucketWriteLocks.leaseOwner, owner)
				)
			);
	}
}
