import { connectDb } from '$lib/server/db';
import { logger } from '$lib/server/logger';
import { runCacheMissClusterFlow } from '$lib/questions/cache-miss.server';

interface PoolDocument {
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

interface QuestionPoolConfig<TDoc extends PoolDocument, TCached extends { cached: boolean }> {
	questionType: 'mcq' | 'frq';
	logScope: string;
	normalizeUnit: (unit?: string | null) => string;
	model: PoolModel<TDoc>;
	getRecentTopics: (className: string, unit: string) => Promise<string[]>;
	serveCached: (doc: TDoc, className: string, cacheUnit: string) => Promise<TCached>;
	generateLive: (className: string, unit: string, recentTopics?: string[]) => Promise<TCached>;
	getLiveTiming?: (result: TCached) => { generationMs: number; persistenceMs: number } | undefined;
}

export type QuestionPathMetrics = {
	questionType: 'mcq' | 'frq';
	segment?: 'cache_hit' | 'cache_miss_leader' | 'cache_miss_follower';
	cacheLookupMs: number;
	lockWaitMs: number;
	generationMs: number;
	persistenceMs: number;
};

export interface GetQuestionOptions {
	excludeQuestionIds?: string[];
	metrics?: QuestionPathMetrics;
}

function normalizeExcludedQuestionIds(ids: string[] | undefined): string[] {
	if (!ids?.length) return [];
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function createQuestionPool<TDoc extends PoolDocument, TCached extends { cached: boolean }>(
	config: QuestionPoolConfig<TDoc, TCached>
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

	async function getQuestion(
		className: string,
		unit?: string,
		options: GetQuestionOptions = {}
	): Promise<TCached> {
		const cacheUnit = config.normalizeUnit(unit);
		const excludeQuestionIds = normalizeExcludedQuestionIds(options.excludeQuestionIds);
		const metrics = options.metrics;

		const lookupStarted = Date.now();
		let doc: TDoc | null;
		try {
			doc = await selectFromPool(className, cacheUnit, excludeQuestionIds);
		} catch (err) {
			if (metrics) metrics.cacheLookupMs = Date.now() - lookupStarted;
			logger.warn(`[${config.logScope}] DB read failed, falling back to live generation`, {
				className,
				unit: cacheUnit,
				error: err
			});
			const generationStarted = Date.now();
			try {
				const recentTopics = await config.getRecentTopics(className, cacheUnit).catch(() => []);
				const result = await config.generateLive(className, unit ?? '', recentTopics);
				if (metrics) {
					metrics.segment = 'cache_miss_leader';
					Object.assign(metrics, config.getLiveTiming?.(result));
				}
				return result;
			} catch (error) {
				if (metrics) metrics.generationMs = Date.now() - generationStarted;
				throw error;
			}
		}
		if (metrics) metrics.cacheLookupMs = Date.now() - lookupStarted;

		if (doc) {
			if (metrics) metrics.segment = 'cache_hit';
			return config.serveCached(doc, className, cacheUnit);
		}

		const missKey = `miss::${config.questionType}::${className}::${cacheUnit}`;

		// Only coalesce unrestricted misses. Session-specific exclusions must not
		// reuse another request's in-flight result (it may be in their exclude list).
		if (!excludeQuestionIds.length && inFlightMiss.has(missKey)) {
			logger.info(`[${config.logScope}] coalescing duplicate cache miss`, {
				className,
				unit: cacheUnit
			});
			const waitStarted = Date.now();
			const result = await inFlightMiss.get(missKey)!;
			if (metrics) {
				metrics.segment = 'cache_miss_follower';
				metrics.lockWaitMs = Date.now() - waitStarted;
			}
			return result;
		}

		logger.info(
			`[${config.logScope}] no reusable cached question found, generating live question`,
			{
				className,
				unit: cacheUnit
			}
		);

		const livePromise: Promise<TCached> = (async (): Promise<TCached> => {
			const generationStarted = Date.now();
			try {
				const { result, meta } = await runCacheMissClusterFlow<TCached>({
					clusterLockKey: missKey,
					tryClaim: async () => {
						const selected = await selectFromPool(className, cacheUnit, excludeQuestionIds);
						if (!selected) return null;
						return config.serveCached(selected, className, cacheUnit);
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
				if (metrics) {
					metrics.segment = meta.role === 'leader' ? 'cache_miss_leader' : 'cache_miss_follower';
					metrics.lockWaitMs = meta.cache_miss_follower_wait_ms;
					if (meta.role === 'leader') Object.assign(metrics, config.getLiveTiming?.(result));
				}

				return result;
			} catch (err) {
				if (metrics) metrics.generationMs = Date.now() - generationStarted;
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
