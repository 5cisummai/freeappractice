import { connectDb } from '$lib/server/db';
import { QUESTION_POOL_CONFIG } from '$lib/questions/pool-constants';
import { logger } from '$lib/server/logger';

interface PoolDocument {
	_id: { toString(): string };
	s3QuestionId?: string;
	randomKey?: number;
	active?: boolean;
}

type LeanFindChain<TDoc> = {
	lean(): Promise<TDoc | null>;
};

interface PoolModel<TDoc extends PoolDocument> {
	findOne(
		filter: Record<string, unknown>,
		projection?: Record<string, 0 | 1> | null,
		options?: { sort?: Record<string, 1 | -1> }
	): LeanFindChain<TDoc> | Promise<TDoc | null>;
	countDocuments(filter: Record<string, unknown>): Promise<number>;
}

interface QuestionPoolConfig<TDoc extends PoolDocument, TCached> {
	questionType: 'mcq' | 'frq';
	logScope: string;
	normalizeUnit: (unit?: string | null) => string;
	model: PoolModel<TDoc>;
	projection: Record<string, 0 | 1>;
	serveCached: (doc: TDoc, className: string, cacheUnit: string) => Promise<TCached> | TCached;
	/** Request asynchronous population when the bucket is empty. */
	requestRefill?: (className: string, unit: string) => Promise<void>;
}

export type QuestionPathMetrics = {
	questionType: 'mcq' | 'frq';
	segment?: 'pool_hit' | 'pool_warming' | 'pool_error';
	dbConnectMs: number;
	poolQueryMs: number;
	/** @deprecated Prefer dbConnectMs + poolQueryMs; kept as sum for transitional clients. */
	cacheLookupMs: number;
	lockWaitMs: number;
	generationMs: number;
	persistenceMs: number;
};

export interface GetQuestionOptions {
	excludeQuestionIds?: string[];
	metrics?: QuestionPathMetrics;
}

export type PoolSelectionResult<TCached> =
	| { status: 'found'; result: TCached; exclusionsReset: boolean }
	| { status: 'warming'; retryAfterSeconds: number }
	| { status: 'failed'; error: unknown };

function normalizeExcludedQuestionIds(ids: string[] | undefined): string[] {
	if (!ids?.length) return [];
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

async function leanFindOne<TDoc extends PoolDocument>(
	model: PoolModel<TDoc>,
	filter: Record<string, unknown>,
	projection: Record<string, 0 | 1>,
	sort: Record<string, 1 | -1>
): Promise<TDoc | null> {
	const result = model.findOne(filter, projection, { sort });
	if (result && typeof result === 'object' && 'lean' in result && typeof result.lean === 'function') {
		return result.lean();
	}
	return result as Promise<TDoc | null>;
}

/**
 * Indexed random selection around a pivot: first `randomKey >= pivot`, then wrap to `< pivot`.
 * Pure helper exported for unit tests.
 */
export async function selectRandomActiveDoc<TDoc extends PoolDocument>(opts: {
	model: PoolModel<TDoc>;
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	projection: Record<string, 0 | 1>;
	pivot?: number;
}): Promise<TDoc | null> {
	const pivot = opts.pivot ?? Math.random();
	const base: Record<string, unknown> = {
		apClass: opts.apClass,
		unit: opts.unit,
		active: { $ne: false }
	};
	if (opts.excludeQuestionIds.length) {
		base.s3QuestionId = { $nin: opts.excludeQuestionIds };
	}

	const first = await leanFindOne<TDoc>(
		opts.model,
		{ ...base, randomKey: { $gte: pivot } },
		opts.projection,
		{ randomKey: 1 }
	);
	if (first) return first;

	return leanFindOne<TDoc>(
		opts.model,
		{ ...base, randomKey: { $lt: pivot } },
		opts.projection,
		{ randomKey: 1 }
	);
}

export function createQuestionPool<TDoc extends PoolDocument, TCached>(
	config: QuestionPoolConfig<TDoc, TCached>
) {
	async function countActive(className: string, cacheUnit: string): Promise<number> {
		return config.model.countDocuments({
			apClass: className,
			unit: cacheUnit,
			active: { $ne: false }
		});
	}

	async function getQuestion(
		className: string,
		unit?: string,
		options: GetQuestionOptions = {}
	): Promise<PoolSelectionResult<TCached>> {
		const cacheUnit = config.normalizeUnit(unit);
		const excludeQuestionIds = normalizeExcludedQuestionIds(options.excludeQuestionIds);
		const metrics = options.metrics;
		const pool = QUESTION_POOL_CONFIG;

		const connectStarted = Date.now();
		try {
			await connectDb();
		} catch (err) {
			if (metrics) {
				metrics.dbConnectMs = Date.now() - connectStarted;
				metrics.cacheLookupMs = metrics.dbConnectMs;
				metrics.segment = 'pool_error';
			}
			logger.error(`[${config.logScope}] DB connect failed`, {
				className,
				unit: cacheUnit,
				error: err
			});
			return { status: 'failed', error: err };
		}
		if (metrics) metrics.dbConnectMs = Date.now() - connectStarted;

		const queryStarted = Date.now();
		try {
			let exclusionsReset = false;
			let doc = await selectRandomActiveDoc({
				model: config.model,
				apClass: className,
				unit: cacheUnit,
				excludeQuestionIds,
				projection: config.projection
			});

			if (!doc && excludeQuestionIds.length) {
				const activeCount = await countActive(className, cacheUnit);
				if (activeCount > 0) {
					exclusionsReset = true;
					doc = await selectRandomActiveDoc({
						model: config.model,
						apClass: className,
						unit: cacheUnit,
						excludeQuestionIds: [],
						projection: config.projection
					});
				}
			}

			if (metrics) {
				metrics.poolQueryMs = Date.now() - queryStarted;
				metrics.cacheLookupMs = metrics.dbConnectMs + metrics.poolQueryMs;
			}

			if (doc) {
				if (metrics) metrics.segment = 'pool_hit';
				const result = await config.serveCached(doc, className, cacheUnit);
				return { status: 'found', result, exclusionsReset };
			}

			if (metrics) metrics.segment = 'pool_warming';
			logger.info(`[${config.logScope}] pool empty, returning POOL_WARMING`, {
				className,
				unit: cacheUnit
			});
			if (config.requestRefill) {
				await config.requestRefill(className, cacheUnit).catch((error) => {
					logger.warn(`[${config.logScope}] failed to enqueue refill`, {
						className,
						unit: cacheUnit,
						error
					});
				});
			}
			return { status: 'warming', retryAfterSeconds: pool.warmingRetryAfterSeconds };
		} catch (err) {
			if (metrics) {
				metrics.poolQueryMs = Date.now() - queryStarted;
				metrics.cacheLookupMs = metrics.dbConnectMs + metrics.poolQueryMs;
				metrics.segment = 'pool_error';
			}
			logger.error(`[${config.logScope}] pool selection failed`, {
				className,
				unit: cacheUnit,
				error: err
			});
			return { status: 'failed', error: err };
		}
	}

	return { getQuestion, selectRandomActiveDoc, countActive };
}
