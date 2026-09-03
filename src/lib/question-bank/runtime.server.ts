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

type PoolBatchQuery<TDoc extends PoolDocument> = (input: {
	apClass: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	limit: number;
	onDatabaseInit?: (elapsedMs: number) => void;
}) => Promise<TDoc[]>;

export interface QuestionBankConfig<TDoc extends PoolDocument, TCached> {
	logScope: string;
	normalizeUnit: (unit?: string | null) => string;
	countActive: (className: string, unit: string) => Promise<number>;
	findRandom: PoolQuery<TDoc>;
	findRandomBatch?: PoolBatchQuery<TDoc>;
	serveCached: (doc: TDoc) => Promise<TCached> | TCached;
	/** Request asynchronous population when the bucket is empty. */
	requestRefill?: (className: string, unit: string) => Promise<void>;
	/** Defer non-critical refill scheduling until after the response when available. */
	scheduleBackgroundTask?: (task: Promise<unknown>) => void;
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

	private async requestRefillAfterMiss(className: string, unit: string): Promise<void> {
		if (!this.config.requestRefill) return;

		const refill = this.config.requestRefill(className, unit).catch((error) => {
			logger.warn(`[${this.config.logScope}] failed to enqueue refill`, {
				className,
				unit,
				error
			});
		});
		if (this.config.scheduleBackgroundTask) {
			this.config.scheduleBackgroundTask(refill);
			return;
		}
		await refill;
	}

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
			await this.requestRefillAfterMiss(className, cacheUnit);
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

	async getMany(
		className: string,
		unit?: string,
		count = 1,
		options: GetQuestionOptions = {}
	): Promise<
		| { status: 'found'; results: TCached[]; exclusionsReset: boolean }
		| Exclude<PoolSelectionResult<TCached>, { status: 'found' }>
	> {
		const cacheUnit = this.config.normalizeUnit(unit);
		const requestedCount = Math.max(1, Math.floor(count));
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
			let docs: TDoc[];
			if (this.config.findRandomBatch) {
				docs = await this.config.findRandomBatch({
					apClass: className,
					unit: cacheUnit,
					excludeQuestionIds,
					pivot: Math.random(),
					limit: requestedCount,
					onDatabaseInit
				});
			} else {
				docs = [];
				const seenIds = [...excludeQuestionIds];
				for (let index = 0; index < requestedCount; index += 1) {
					const doc = await selectRandomActiveDoc({
						findRandom: this.config.findRandom,
						apClass: className,
						unit: cacheUnit,
						excludeQuestionIds: seenIds,
						onDatabaseInit
					});
					if (!doc) break;
					docs.push(doc);
					if (doc.questionId) seenIds.push(doc.questionId);
				}
			}

			if (docs.length < requestedCount && excludeQuestionIds.length) {
				const activeCount = await this.config.countActive(className, cacheUnit);
				if (activeCount > 0) {
					exclusionsReset = true;
					const selectedIds = docs
						.map((doc) => doc.questionId)
						.filter((id): id is string => Boolean(id));
					const moreDocs = this.config.findRandomBatch
						? await this.config.findRandomBatch({
								apClass: className,
								unit: cacheUnit,
								excludeQuestionIds: [...selectedIds],
								pivot: Math.random(),
								limit: requestedCount - docs.length,
								onDatabaseInit
							})
						: [];
					docs = [...docs, ...moreDocs];
				}
			}

			if (metrics) {
				metrics.poolQueryMs = Date.now() - queryStarted;
			}

			if (docs.length) {
				if (metrics) metrics.segment = 'pool_hit';
				const results = await Promise.all(docs.map((doc) => this.config.serveCached(doc)));
				return { status: 'found', results, exclusionsReset };
			}

			if (metrics) metrics.segment = 'pool_warming';
			logger.info(`[${this.config.logScope}] pool empty, returning POOL_WARMING`, {
				className,
				unit: cacheUnit
			});
			await this.requestRefillAfterMiss(className, cacheUnit);
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
