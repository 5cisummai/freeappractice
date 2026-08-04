import { randomUUID } from 'node:crypto';
import { PoolBucketWriteLock } from '$lib/questions/pool-refill-model.server';
import { countActivePoolRows, type PoolBucketKey } from '$lib/questions/pool-refill-queue.server';
import { isDuplicateKeyError } from '$lib/questions/util.server';
import { connectDb } from '$lib/server/db';

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
	await connectDb();
	const key = {
		questionType: bucket.questionType,
		apClass: bucket.apClass,
		unit: bucket.unit
	};
	const owner = randomUUID();

	try {
		await PoolBucketWriteLock.updateOne(
			key,
			{ $setOnInsert: { ...key, leaseOwner: null, leaseExpiresAt: null } },
			{ upsert: true }
		).exec();
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
	}

	let acquired = false;
	for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
		const now = new Date();
		const lock = await PoolBucketWriteLock.findOneAndUpdate(
			{
				...key,
				$or: [{ leaseOwner: null }, { leaseExpiresAt: null }, { leaseExpiresAt: { $lte: now } }]
			},
			{
				$set: {
					leaseOwner: owner,
					leaseExpiresAt: new Date(now.getTime() + LOCK_TTL_MS)
				}
			},
			{ returnDocument: 'after' }
		).exec();
		if (lock) {
			acquired = true;
			break;
		}
		await delay(LOCK_RETRY_MS);
	}

	if (!acquired)
		throw new Error(`Timed out waiting for the ${bucket.questionType} pool write lock`);

	try {
		const activeCount = await countActivePoolRows(bucket.questionType, bucket.apClass, bucket.unit);
		if (activeCount >= target) return { status: 'at_target', activeCount };
		return { status: 'written', value: await write() };
	} finally {
		await PoolBucketWriteLock.updateOne(
			{ ...key, leaseOwner: owner },
			{ $set: { leaseOwner: null, leaseExpiresAt: null } }
		).exec();
	}
}
