import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { poolBucketWriteLocks } from '#lib/server/neon/schema.js';
import {
	countActivePoolRowsForServing,
	type PoolBucketKey
} from '#lib/question-bank/pool-refill-queue.server.js';
import { isDuplicateKeyError } from '#lib/question-bank/util.server.js';

const LOCK_TTL_MS = 120_000;
const LOCK_RETRY_MS = 50;
const LOCK_ATTEMPTS = 200;

type CapacityResult<T> =
	{ status: 'written'; value: T } | { status: 'at_target'; activeCount: number };

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockBucket(bucket: PoolBucketKey): PoolBucketKey {
	return {
		questionType: bucket.questionType,
		course: bucket.course,
		unit: bucket.unit
	};
}

function lockKey(bucket: PoolBucketKey): string {
	return `${bucket.questionType}\u0000${bucket.course}\u0000${bucket.unit}`;
}

function uniqueLockBuckets(buckets: PoolBucketKey[]): PoolBucketKey[] {
	const seen = new Set<string>();
	const unique: PoolBucketKey[] = [];
	for (const bucket of buckets) {
		const key = lockKey(bucket);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(lockBucket(bucket));
	}
	return unique;
}

function matchLockBuckets(buckets: PoolBucketKey[]) {
	const matches = buckets.map((bucket) =>
		and(
			eq(poolBucketWriteLocks.questionType, bucket.questionType),
			eq(poolBucketWriteLocks.course, bucket.course),
			eq(poolBucketWriteLocks.unit, bucket.unit)
		)
	);
	const first = matches[0];
	if (!first) return eq(poolBucketWriteLocks.id, '');
	if (matches.length === 1) return first;
	return or(first, ...matches.slice(1));
}

async function ensureLockRows(buckets: PoolBucketKey[]): Promise<void> {
	if (!buckets.length) return;
	try {
		await getNeonDatabase()
			.insert(poolBucketWriteLocks)
			.values(
				buckets.map((bucket) => ({
					id: randomUUID(),
					...bucket,
					leaseOwner: null,
					leaseExpiresAt: null
				}))
			)
			.onConflictDoNothing();
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
	}
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
	const owner = randomUUID();
	const acquired = await acquirePoolBucketWriteLocks([bucket], owner);
	if (!acquired.length)
		throw new Error(`Timed out waiting for the ${bucket.questionType} pool write lock`);

	try {
		const activeCount = await countActivePoolRowsForServing(
			bucket.questionType,
			bucket.course,
			bucket.unit
		);
		if (activeCount >= target) return { status: 'at_target', activeCount };
		return { status: 'written', value: await write() };
	} finally {
		await releasePoolBucketWriteLocks(acquired, owner);
	}
}

export async function acquirePoolBucketWriteLocks(
	buckets: PoolBucketKey[],
	owner: string
): Promise<PoolBucketKey[]> {
	const unique = uniqueLockBuckets(buckets);
	if (!unique.length) return [];

	await ensureLockRows(unique);

	const acquired = new Map<string, PoolBucketKey>();
	for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
		const remaining = unique.filter((bucket) => !acquired.has(lockKey(bucket)));
		if (!remaining.length) break;

		const now = new Date();
		const rows = await getNeonDatabase()
			.update(poolBucketWriteLocks)
			.set({ leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + LOCK_TTL_MS) })
			.where(
				and(
					matchLockBuckets(remaining),
					or(
						isNull(poolBucketWriteLocks.leaseOwner),
						isNull(poolBucketWriteLocks.leaseExpiresAt),
						lte(poolBucketWriteLocks.leaseExpiresAt, now)
					)
				)
			)
			.returning({
				questionType: poolBucketWriteLocks.questionType,
				course: poolBucketWriteLocks.course,
				unit: poolBucketWriteLocks.unit
			});
		for (const row of rows) {
			const bucket = lockBucket({
				questionType: row.questionType as PoolBucketKey['questionType'],
				course: row.course,
				unit: row.unit
			});
			acquired.set(lockKey(bucket), bucket);
		}
		if (acquired.size === unique.length) break;
		await delay(LOCK_RETRY_MS);
	}

	return [...acquired.values()];
}

export async function releasePoolBucketWriteLocks(
	buckets: PoolBucketKey[],
	owner: string
): Promise<void> {
	const unique = uniqueLockBuckets(buckets);
	if (!unique.length) return;
	await getNeonDatabase()
		.update(poolBucketWriteLocks)
		.set({ leaseOwner: null, leaseExpiresAt: null })
		.where(and(matchLockBuckets(unique), eq(poolBucketWriteLocks.leaseOwner, owner)));
}
