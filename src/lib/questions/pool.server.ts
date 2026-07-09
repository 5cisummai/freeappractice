import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { runCacheMissClusterFlow } from '$lib/questions/cache-miss.server';
import { CacheMissLock } from '$lib/questions/cache-lock.server';
import { isDuplicateKeyError } from '$lib/questions/util.server';

function getReplenishLockTtlMs(): number {
	return Math.max(10_000, parseInt(process.env.CACHE_REPLENISH_LOCK_TTL_MS ?? '', 10) || 120_000);
}

async function tryAcquireReplenishLock(key: string): Promise<boolean> {
	await connectDb();
	try {
		await CacheMissLock.create({
			key,
			expiresAt: new Date(Date.now() + getReplenishLockTtlMs())
		});
		return true;
	} catch (err) {
		if (isDuplicateKeyError(err)) return false;
		throw err;
	}
}

async function releaseReplenishLock(key: string): Promise<void> {
	await connectDb();
	await CacheMissLock.deleteOne({ key }).catch(() => {});
}

export interface PoolDocument {
	_id: { toString(): string };
	serveCount?: number;
	maxServeCount?: number;
}

interface PoolModel<TDoc extends PoolDocument> {
	updateMany(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<unknown>;
	countDocuments(filter: Record<string, unknown>): Promise<number>;
	findOneAndUpdate(
		filter: Record<string, unknown>,
		update: Record<string, unknown>,
		options: { sort: Record<string, 1 | -1> }
	): Promise<TDoc | null>;
	updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<unknown>;
	deleteOne(filter: Record<string, unknown>): Promise<unknown>;
}

export interface McqPoolConfig<TDoc extends PoolDocument, TCached extends { cached: boolean }> {
	logScope: string;
	getPoolSize: () => number;
	normalizeUnit: (unit?: string | null) => string;
	model: PoolModel<TDoc>;
	getRecentTopics: (className: string, unit: string) => Promise<string[]>;
	generateAndInsert: (className: string, unit: string) => Promise<string | null>;
	serveClaimed: (
		doc: TDoc,
		className: string,
		cacheUnit: string,
		replenish: (className: string, unit: string) => void
	) => Promise<TCached>;
	generateLive: (className: string, unit: string, recentTopics?: string[]) => Promise<TCached>;
}

export function createMcqPool<TDoc extends PoolDocument, TCached extends { cached: boolean }>(
	config: McqPoolConfig<TDoc, TCached>
) {
	const replenishing = new Set<string>();
	const inFlightMiss = new Map<string, Promise<TCached>>();

	async function claimDoc(filter: Record<string, unknown>): Promise<TDoc | null> {
		return config.model.findOneAndUpdate(
			{
				...filter,
				status: 'available',
				$expr: {
					$lt: [{ $ifNull: ['$serveCount', 0] }, { $ifNull: ['$maxServeCount', 50] }]
				}
			},
			{ $inc: { serveCount: 1 }, $set: { lastServedAt: new Date() } },
			{ sort: { lastServedAt: 1, createdAt: 1 } }
		);
	}

	async function claimFromPool(className: string, cacheUnit: string): Promise<TDoc | null> {
		await connectDb();
		return claimDoc({ apClass: className, unit: cacheUnit });
	}

	function deleteIfFullyServed(doc: TDoc, currentServeCount: number, maxServeCount: number): void {
		const docId = doc._id.toString();
		const nextServeCount = currentServeCount + 1;
		if (nextServeCount >= maxServeCount) {
			// Hot cache is ephemeral — drop the pool doc once fully served.
			config.model.deleteOne({ _id: docId }).catch(() => {});
		}
	}

	function replenishPool(className: string, unit: string): void {
		const cacheUnit = config.normalizeUnit(unit);
		const key = `${className}::${cacheUnit}`;
		const lockKey = `replenish::mcq::${key}`;
		if (replenishing.has(key)) return;
		replenishing.add(key);

		(async () => {
			let hasLock = false;
			try {
				await connectDb();
				hasLock = await tryAcquireReplenishLock(lockKey);
				if (!hasLock) return;
				const poolSize = config.getPoolSize();

				await config.model.updateMany(
					{
						apClass: className,
						unit: cacheUnit,
						status: 'serving',
						lockedUntil: { $lt: new Date() }
					},
					{ $set: { status: 'available', lockedUntil: null } }
				);

				for (let i = 0; i < poolSize; i++) {
					const active = await config.model.countDocuments({
						apClass: className,
						unit: cacheUnit,
						status: { $in: ['available', 'serving'] }
					});
					if (active >= poolSize) break;

					logger.info(`[${config.logScope}] replenishing - active: ${active}/${poolSize}`, {
						className,
						unit: cacheUnit
					});
					await config.generateAndInsert(className, unit);
				}

				const after = await config.model.countDocuments({
					apClass: className,
					unit: cacheUnit,
					status: 'available'
				});
				logger.info(`[${config.logScope}] replenish done - ${after} available question(s)`, {
					className,
					unit: cacheUnit
				});
			} catch (err) {
				logger.error(`[${config.logScope}] replenishPool error`, { className, unit, error: err });
			} finally {
				if (hasLock) {
					await releaseReplenishLock(lockKey);
				}
				replenishing.delete(key);
			}
		})();
	}

	async function serveClaimedDoc(
		doc: TDoc,
		className: string,
		cacheUnit: string
	): Promise<TCached> {
		deleteIfFullyServed(doc, doc.serveCount ?? 0, doc.maxServeCount ?? 50);
		return config.serveClaimed(doc, className, cacheUnit, replenishPool);
	}

	async function getQuestion(className: string, unit?: string): Promise<TCached> {
		const cacheUnit = config.normalizeUnit(unit);

		let doc: TDoc | null;
		try {
			doc = await claimFromPool(className, cacheUnit);
		} catch (err) {
			logger.warn(`[${config.logScope}] DB read failed, falling back to live generation`, {
				className,
				unit: cacheUnit,
				error: err
			});
			return config.generateLive(className, unit ?? '');
		}

		if (doc) {
			return serveClaimedDoc(doc, className, cacheUnit);
		}

		const missKey = `miss::mcq::${className}::${cacheUnit}`;

		if (inFlightMiss.has(missKey)) {
			logger.info(`[${config.logScope}] coalescing duplicate cache miss`, {
				className,
				unit: cacheUnit
			});
			return inFlightMiss.get(missKey)!;
		}

		logger.info(`[${config.logScope}] pool empty, generating live question`, {
			className,
			unit: cacheUnit
		});
		replenishPool(className, unit ?? '');

		const livePromise: Promise<TCached> = (async (): Promise<TCached> => {
			try {
				const { result, meta } = await runCacheMissClusterFlow<TCached>({
					clusterLockKey: missKey,
					tryClaim: async () => {
						const claimed = await claimFromPool(className, cacheUnit);
						if (!claimed) return null;
						return serveClaimedDoc(claimed, className, cacheUnit);
					},
					leaderRun: async () => {
						const recentTopics = await config.getRecentTopics(className, cacheUnit).catch(() => []);
						const gen = await config.generateLive(className, unit ?? '', recentTopics);
						return { ...gen, cached: false };
					},
					logScope: config.logScope
				});

				logger.info(`[${config.logScope}] cache_miss_cluster_complete`, {
					className,
					unit: cacheUnit,
					cache_miss_role: meta.role,
					cache_miss_follower_wait_ms: meta.cache_miss_follower_wait_ms
				});

				return result;
			} catch (err) {
				logger.error(`[${config.logScope}] live generation also failed`, {
					className,
					unit: cacheUnit,
					error: err
				});
				throw err;
			} finally {
				inFlightMiss.delete(missKey);
			}
		})();

		inFlightMiss.set(missKey, livePromise);
		return livePromise;
	}

	return {
		claimFromPool,
		replenishPool,
		deleteIfFullyServed,
		getQuestion
	};
}
