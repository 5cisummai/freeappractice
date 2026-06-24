import { SeenQuestion } from '$lib/questions/seen.server';
import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { runCacheMissClusterFlow } from '$lib/questions/cache-miss.server';
import { recordSeenQuestion } from '$lib/questions/util.server';

const LOCK_WINDOW_MS = 10_000;

export interface PoolDocument {
	_id: { toString(): string };
	s3QuestionId?: string;
	contentHash?: string;
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

export interface QuestionPoolConfig<
	TDoc extends PoolDocument,
	TCached extends { cached: boolean }
> {
	questionType: 'mcq';
	logScope: string;
	defaultUnit: string;
	getPoolSize: () => number;
	recentTopicsWindow: number;
	normalizeUnit: (unit?: string | null) => string;
	model: PoolModel<TDoc>;
	runStartupMigration: () => Promise<void>;
	getRecentTopics: (className: string, unit: string) => Promise<string[]>;
	generateAndInsert: (className: string, unit: string) => Promise<string | null>;
	serveClaimed: (
		doc: TDoc,
		className: string,
		cacheUnit: string,
		userId: string | null | undefined,
		replenish: (className: string, unit: string) => void
	) => Promise<TCached>;
	generateLive: (className: string, unit: string, recentTopics?: string[]) => Promise<TCached>;
	persistLiveToPool: (className: string, cacheUnit: string, result: TCached) => Promise<void>;
	getContentHashFromResult: (result: TCached) => string;
}

export function createQuestionPool<TDoc extends PoolDocument, TCached extends { cached: boolean }>(
	config: QuestionPoolConfig<TDoc, TCached>
) {
	const replenishing = new Set<string>();
	const inFlightMiss = new Map<string, Promise<TCached>>();

	connectDb()
		.then(() => config.runStartupMigration())
		.catch(() => {});

	async function claimDoc(filter: Record<string, unknown>): Promise<TDoc | null> {
		const lockedUntil = new Date(Date.now() + LOCK_WINDOW_MS);
		return config.model.findOneAndUpdate(
			{ ...filter, status: 'available' },
			{ $set: { status: 'serving', lockedUntil } },
			{ sort: { lastServedAt: 1, createdAt: 1 } }
		);
	}

	async function claimForUser(
		className: string,
		cacheUnit: string,
		userId: string | null | undefined
	): Promise<TDoc | null> {
		await connectDb();

		const baseFilter: Record<string, unknown> = { apClass: className, unit: cacheUnit };

		if (userId) {
			const seenHashes = await SeenQuestion.find(
				{
					userId,
					apClass: className,
					unit: cacheUnit,
					questionType: config.questionType
				},
				{ contentHash: 1 }
			)
				.lean()
				.then((docs) => docs.map((d) => d.contentHash));

			if (seenHashes.length > 0) {
				baseFilter['contentHash'] = { $nin: seenHashes };
			}
		}

		let doc = await claimDoc(baseFilter);

		if (!doc && userId) {
			logger.info(
				`[${config.logScope}] all pooled questions already seen by user, falling back to any`,
				{ className, unit: cacheUnit, userId }
			);
			doc = await claimDoc({ apClass: className, unit: cacheUnit });
		}

		return doc;
	}

	function releaseDoc(doc: TDoc, currentServeCount: number, maxServeCount: number): void {
		const docId = doc._id.toString();
		const nextServeCount = currentServeCount + 1;
		if (nextServeCount >= maxServeCount) {
			// Slim docs: body is in S3 — safe to drop from the pool.
			// Legacy docs: retire so Mongo-id history/bookmark lookups keep working.
			if (doc.s3QuestionId) {
				config.model.deleteOne({ _id: docId }).catch(() => {});
			} else {
				config.model
					.updateOne(
						{ _id: docId },
						{
							$set: {
								serveCount: nextServeCount,
								lastServedAt: new Date(),
								lockedUntil: null,
								status: 'retired'
							}
						}
					)
					.catch(() => {});
			}
			return;
		}
		config.model
			.updateOne(
				{ _id: docId },
				{
					$inc: { serveCount: 1 },
					$set: { lastServedAt: new Date(), lockedUntil: null, status: 'available' }
				}
			)
			.catch(() => {});
	}

	function replenishPool(className: string, unit: string): void {
		const cacheUnit = config.normalizeUnit(unit);
		const key = `${className}::${cacheUnit}`;
		if (replenishing.has(key)) return;
		replenishing.add(key);

		(async () => {
			try {
				await connectDb();
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
					const available = await config.model.countDocuments({
						apClass: className,
						unit: cacheUnit,
						status: 'available'
					});
					if (available >= poolSize) break;

					logger.info(`[${config.logScope}] replenishing - available: ${available}/${poolSize}`, {
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
				replenishing.delete(key);
			}
		})();
	}

	async function serveClaimedDoc(
		doc: TDoc,
		className: string,
		cacheUnit: string,
		userId: string | null | undefined
	): Promise<TCached> {
		releaseDoc(doc, doc.serveCount ?? 0, doc.maxServeCount ?? 50);

		if (userId && doc.contentHash) {
			recordSeenQuestion(userId, doc.contentHash, className, cacheUnit, config.questionType).catch(
				() => {}
			);
		}

		return config.serveClaimed(doc, className, cacheUnit, userId, replenishPool);
	}

	async function getQuestion(
		className: string,
		unit?: string,
		userId?: string | null
	): Promise<TCached> {
		const cacheUnit = config.normalizeUnit(unit);

		let doc: TDoc | null;
		try {
			doc = await claimForUser(className, cacheUnit, userId);
		} catch (err) {
			logger.warn(`[${config.logScope}] DB read failed, falling back to live generation`, {
				className,
				unit: cacheUnit,
				error: err
			});
			return config.generateLive(className, unit ?? '');
		}

		if (doc) {
			return serveClaimedDoc(doc, className, cacheUnit, userId);
		}

		const missKey = `miss::${config.questionType}::${className}::${cacheUnit}`;

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
						const claimed = await claimForUser(className, cacheUnit, userId);
						if (!claimed) return null;
						return serveClaimedDoc(claimed, className, cacheUnit, userId);
					},
					leaderRun: async () => {
						const recentTopics = await config.getRecentTopics(className, cacheUnit).catch(() => []);
						const gen = await config.generateLive(className, unit ?? '', recentTopics);
						await config.persistLiveToPool(className, cacheUnit, gen);
						if (userId) {
							const hash = config.getContentHashFromResult(gen);
							recordSeenQuestion(userId, hash, className, cacheUnit, config.questionType).catch(
								() => {}
							);
						}
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
		claimForUser,
		replenishPool,
		releaseDoc,
		getQuestion
	};
}
