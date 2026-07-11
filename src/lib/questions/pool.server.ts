import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { runCacheMissClusterFlow } from '$lib/questions/cache-miss.server';

export interface PoolDocument {
	_id: { toString(): string };
	s3QuestionId?: string;
}

interface PoolModel<TDoc extends PoolDocument> {
	findOne(
		filter: Record<string, unknown>,
		projection: null,
		options: { sort: Record<string, 1 | -1> }
	): Promise<TDoc | null>;
}

export interface McqPoolConfig<TDoc extends PoolDocument, TCached extends { cached: boolean }> {
	logScope: string;
	normalizeUnit: (unit?: string | null) => string;
	model: PoolModel<TDoc>;
	getRecentTopics: (className: string, unit: string) => Promise<string[]>;
	serveCached: (doc: TDoc, className: string, cacheUnit: string) => Promise<TCached>;
	generateLive: (className: string, unit: string, recentTopics?: string[]) => Promise<TCached>;
}

export interface GetQuestionOptions {
	excludeQuestionIds?: string[];
}

function normalizeExcludedQuestionIds(ids: string[] | undefined): string[] {
	if (!ids?.length) return [];
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function createMcqPool<TDoc extends PoolDocument, TCached extends { cached: boolean }>(
	config: McqPoolConfig<TDoc, TCached>
) {
	const inFlightMiss = new Map<string, Promise<TCached>>();

	async function findCachedDoc(
		filter: Record<string, unknown>,
		excludeQuestionIds: string[]
	): Promise<TDoc | null> {
		return config.model.findOne(
			excludeQuestionIds.length
				? { ...filter, s3QuestionId: { $nin: excludeQuestionIds } }
				: filter,
			null,
			{ sort: { createdAt: 1 } }
		);
	}

	async function selectFromPool(
		className: string,
		cacheUnit: string,
		excludeQuestionIds: string[] = []
	): Promise<TDoc | null> {
		await connectDb();
		return findCachedDoc({ apClass: className, unit: cacheUnit }, excludeQuestionIds);
	}

	async function serveCachedDoc(doc: TDoc, className: string, cacheUnit: string): Promise<TCached> {
		return config.serveCached(doc, className, cacheUnit);
	}

	async function getQuestion(
		className: string,
		unit?: string,
		options: GetQuestionOptions = {}
	): Promise<TCached> {
		const cacheUnit = config.normalizeUnit(unit);
		const excludeQuestionIds = normalizeExcludedQuestionIds(options.excludeQuestionIds);

		let doc: TDoc | null;
		try {
			doc = await selectFromPool(className, cacheUnit, excludeQuestionIds);
		} catch (err) {
			logger.warn(`[${config.logScope}] DB read failed, falling back to live generation`, {
				className,
				unit: cacheUnit,
				error: err
			});
			return config.generateLive(className, unit ?? '');
		}

		if (doc) {
			return serveCachedDoc(doc, className, cacheUnit);
		}

		const missKey = `miss::mcq::${className}::${cacheUnit}`;

		// Only coalesce unrestricted misses. Session-specific exclusions must not
		// reuse another request's in-flight result (it may be in their exclude list).
		if (!excludeQuestionIds.length && inFlightMiss.has(missKey)) {
			logger.info(`[${config.logScope}] coalescing duplicate cache miss`, {
				className,
				unit: cacheUnit
			});
			return inFlightMiss.get(missKey)!;
		}

		logger.info(
			`[${config.logScope}] no reusable cached question found, generating live question`,
			{
				className,
				unit: cacheUnit
			}
		);

		const livePromise: Promise<TCached> = (async (): Promise<TCached> => {
			try {
				const { result, meta } = await runCacheMissClusterFlow<TCached>({
					clusterLockKey: missKey,
					tryClaim: async () => {
						const selected = await selectFromPool(className, cacheUnit, excludeQuestionIds);
						if (!selected) return null;
						return serveCachedDoc(selected, className, cacheUnit);
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
				if (!excludeQuestionIds.length) {
					inFlightMiss.delete(missKey);
				}
			}
		})();

		if (!excludeQuestionIds.length) {
			inFlightMiss.set(missKey, livePromise);
		}
		return livePromise;
	}

	return {
		getQuestion
	};
}
