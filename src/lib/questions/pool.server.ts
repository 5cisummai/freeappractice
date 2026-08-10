import { QUESTION_POOL_CONFIG } from '$lib/questions/pool-constants';
import { countActivePoolRows } from '$lib/questions/pool-counts.server';
import { logger } from '$lib/server/logger';

interface PoolDocument {
	questionId?: string;
	randomKey?: number;
	active?: boolean;
}

type PoolQuery<TDoc extends PoolDocument> = (input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	fromPivot: 'after' | 'before';
	onDatabaseInit?: (elapsedMs: number) => void;
}) => Promise<TDoc | null>;

interface QuestionPoolConfig<TDoc extends PoolDocument, TCached> {
	questionType: 'mcq' | 'frq';
	logScope: string;
	normalizeUnit: (unit?: string | null) => string;
	findRandom: PoolQuery<TDoc>;
	serveCached: (doc: TDoc, className: string, cacheUnit: string) => Promise<TCached> | TCached;
	/** Request asynchronous population when the bucket is empty. */
	requestRefill?: (className: string, unit: string) => Promise<void>;
}

export type QuestionPathMetrics = {
	questionType: 'mcq' | 'frq';
	segment?: 'pool_hit' | 'pool_warming' | 'pool_error';
	/** Neon HTTP client initialization; awaited network/SQL time is poolQueryMs. */
	dbConnectMs: number;
	poolQueryMs: number;
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

/**
 * Indexed random selection around a pivot: first `randomKey >= pivot`, then wrap to `< pivot`.
 * Pure helper exported for unit tests.
 */
export async function selectRandomActiveDoc<TDoc extends PoolDocument>(opts: {
	findRandom: PoolQuery<TDoc>;
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot?: number;
	onDatabaseInit?: (elapsedMs: number) => void;
}): Promise<TDoc | null> {
	const pivot = opts.pivot ?? Math.random();
	const first = await opts.findRandom({
		apClass: opts.apClass,
		unit: opts.unit,
		excludeQuestionIds: opts.excludeQuestionIds,
		pivot,
		fromPivot: 'after',
		onDatabaseInit: opts.onDatabaseInit
	});
	if (first) return first;

	return opts.findRandom({
		apClass: opts.apClass,
		unit: opts.unit,
		excludeQuestionIds: opts.excludeQuestionIds,
		pivot,
		fromPivot: 'before',
		onDatabaseInit: opts.onDatabaseInit
	});
}

export function createQuestionPool<TDoc extends PoolDocument, TCached>(
	config: QuestionPoolConfig<TDoc, TCached>
) {
	async function countActive(className: string, cacheUnit: string): Promise<number> {
		return countActivePoolRows(config.questionType, className, cacheUnit);
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

		const onDatabaseInit = metrics
			? (elapsedMs: number) => {
					metrics.dbConnectMs = Math.max(metrics.dbConnectMs, elapsedMs);
				}
			: undefined;

		const queryStarted = Date.now();
		try {
			let exclusionsReset = false;
			let doc = await selectRandomActiveDoc({
				findRandom: config.findRandom,
				apClass: className,
				unit: cacheUnit,
				excludeQuestionIds,
				onDatabaseInit
			});

			if (!doc && excludeQuestionIds.length) {
				const activeCount = await countActive(className, cacheUnit);
				if (activeCount > 0) {
					exclusionsReset = true;
					doc = await selectRandomActiveDoc({
						findRandom: config.findRandom,
						apClass: className,
						unit: cacheUnit,
						excludeQuestionIds: [],
						onDatabaseInit
					});
				}
			}

			if (metrics) {
				metrics.poolQueryMs = Date.now() - queryStarted;
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
