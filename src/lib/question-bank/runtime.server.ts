import { QUESTION_POOL_CONFIG } from '$lib/question-bank/pool-constants';
import { logger } from '$lib/server/logger';

export interface PoolDocument {
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

export interface QuestionBankConfig<TDoc extends PoolDocument, TCached> {
	logScope: string;
	normalizeUnit: (unit?: string | null) => string;
	countActive: (className: string, unit: string) => Promise<number>;
	findRandom: PoolQuery<TDoc>;
	serveCached: (doc: TDoc) => Promise<TCached> | TCached;
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

/**
 * A configured Question Bank owns selection, exclusions, warming, metrics, and
 * refill scheduling. Type-specific modules only provide storage and rendering
 * adapters, so adding a new bank does not require copying this lifecycle.
 */
export class QuestionBank<TDoc extends PoolDocument, TCached> {
	constructor(private readonly config: QuestionBankConfig<TDoc, TCached>) {}

	async get(
		className: string,
		unit?: string,
		options: GetQuestionOptions = {}
	): Promise<PoolSelectionResult<TCached>> {
		const cacheUnit = this.config.normalizeUnit(unit);
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
				findRandom: this.config.findRandom,
				apClass: className,
				unit: cacheUnit,
				excludeQuestionIds,
				onDatabaseInit
			});

			if (!doc && excludeQuestionIds.length) {
				const activeCount = await this.config.countActive(className, cacheUnit);
				if (activeCount > 0) {
					exclusionsReset = true;
					doc = await selectRandomActiveDoc({
						findRandom: this.config.findRandom,
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
				const result = await this.config.serveCached(doc);
				return { status: 'found', result, exclusionsReset };
			}

			if (metrics) metrics.segment = 'pool_warming';
			logger.info(`[${this.config.logScope}] pool empty, returning POOL_WARMING`, {
				className,
				unit: cacheUnit
			});
			if (this.config.requestRefill) {
				await this.config.requestRefill(className, cacheUnit).catch((error) => {
					logger.warn(`[${this.config.logScope}] failed to enqueue refill`, {
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
			logger.error(`[${this.config.logScope}] pool selection failed`, {
				className,
				unit: cacheUnit,
				error: err
			});
			return { status: 'failed', error: err };
		}
	}
}
