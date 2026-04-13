import { connectDb } from '$lib/server/db';
import { CacheMissLock } from '$lib/server/models/cache-miss-lock';
import { logger } from '$lib/server/logger';

function isDuplicateKeyError(err: unknown): boolean {
	return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** How long the lock document lives if the leader never releases (crash / timeout). */
export function getCacheMissLockTtlMs(): number {
	return Math.max(10_000, parseInt(process.env.CACHE_MISS_LOCK_TTL_MS ?? '', 10) || 120_000);
}

/** How long followers retry pool claims (and lock steal) before fallback live generation. */
export function getCacheMissFollowerMaxWaitMs(): number {
	return Math.max(5_000, parseInt(process.env.CACHE_MISS_FOLLOWER_MAX_WAIT_MS ?? '', 10) || 45_000);
}

export async function tryAcquireCacheMissLock(key: string, ttlMs: number): Promise<boolean> {
	await connectDb();
	try {
		await CacheMissLock.create({
			key,
			expiresAt: new Date(Date.now() + ttlMs)
		});
		return true;
	} catch (err) {
		if (isDuplicateKeyError(err)) return false;
		throw err;
	}
}

export async function releaseCacheMissLock(key: string): Promise<void> {
	await connectDb();
	await CacheMissLock.deleteOne({ key }).catch(() => {});
}

export type CacheMissRole = 'leader' | 'follower';

export type CacheMissClusterMeta = {
	role: CacheMissRole;
	/** Wall time spent in follower path (0 for immediate leader). */
	cache_miss_follower_wait_ms: number;
};

/**
 * Cross-instance cache-miss coordination for serverless: one leader generates;
 * followers wait and claim from the pool, steal the lock after TTL, or fall back to live generation.
 */
export async function runCacheMissClusterFlow<T>(options: {
	clusterLockKey: string;
	tryClaim: () => Promise<T | null>;
	leaderRun: () => Promise<T>;
	logScope: string;
}): Promise<{ result: T; meta: CacheMissClusterMeta }> {
	const ttlMs = getCacheMissLockTtlMs();
	const maxWaitMs = getCacheMissFollowerMaxWaitMs();
	const { clusterLockKey, tryClaim, leaderRun, logScope } = options;

	const t0 = Date.now();

	const early = await tryClaim();
	if (early !== null) {
		return {
			result: early,
			meta: {
				role: 'follower',
				cache_miss_follower_wait_ms: Date.now() - t0
			}
		};
	}

	if (await tryAcquireCacheMissLock(clusterLockKey, ttlMs)) {
		logger.info(`[${logScope}] cache_miss_leader`, { clusterLockKey });
		try {
			const result = await leaderRun();
			return {
				result,
				meta: { role: 'leader', cache_miss_follower_wait_ms: 0 }
			};
		} finally {
			await releaseCacheMissLock(clusterLockKey);
		}
	}

	logger.info(`[${logScope}] cache_miss_follower_waiting`, { clusterLockKey, maxWaitMs });

	const deadline = Date.now() + maxWaitMs;
	let backoff = 50;

	while (Date.now() < deadline) {
		const claimed = await tryClaim();
		if (claimed !== null) {
			const cache_miss_follower_wait_ms = Date.now() - t0;
			logger.info(`[${logScope}] cache_miss_follower_claimed`, {
				clusterLockKey,
				cache_miss_follower_wait_ms
			});
			return {
				result: claimed,
				meta: { role: 'follower', cache_miss_follower_wait_ms }
			};
		}

		if (await tryAcquireCacheMissLock(clusterLockKey, ttlMs)) {
			logger.info(`[${logScope}] cache_miss_follower_promoted_leader`, { clusterLockKey });
			try {
				const result = await leaderRun();
				return {
					result,
					meta: {
						role: 'leader',
						cache_miss_follower_wait_ms: Date.now() - t0
					}
				};
			} finally {
				await releaseCacheMissLock(clusterLockKey);
			}
		}

		await new Promise((r) => setTimeout(r, backoff));
		backoff = Math.min(backoff * 2, 500);
	}

	logger.warn(`[${logScope}] cache_miss_follower_timeout`, { clusterLockKey, maxWaitMs });

	if (await tryAcquireCacheMissLock(clusterLockKey, ttlMs)) {
		try {
			const result = await leaderRun();
			return {
				result,
				meta: { role: 'leader', cache_miss_follower_wait_ms: Date.now() - t0 }
			};
		} finally {
			await releaseCacheMissLock(clusterLockKey);
		}
	}

	const cache_miss_follower_wait_ms = Date.now() - t0;
	const result = await leaderRun();
	logger.info(`[${logScope}] cache_miss_follower_fallback_live`, {
		clusterLockKey,
		cache_miss_follower_wait_ms
	});
	return {
		result,
		meta: { role: 'follower', cache_miss_follower_wait_ms }
	};
}
