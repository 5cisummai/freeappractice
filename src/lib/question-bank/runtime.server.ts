import { QUESTION_POOL_CONFIG } from '$lib/question-bank/pool-constants';
import { logger } from '$lib/server/logger';

export interface PoolDocument {
	questionId?: string;
	randomKey?: number;
	active?: boolean;
}

type PoolQuery<TDoc extends PoolDocument> = (input: {
	course: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	fromPivot: 'after' | 'before';
	onDatabaseInit?: (elapsedMs: number) => void;
	allowStimulusQuestions?: boolean;
}) => Promise<TDoc | null>;

type PoolBatchQuery<TDoc extends PoolDocument> = (input: {
	course: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot: number;
	limit: number;
	onDatabaseInit?: (elapsedMs: number) => void;
	allowStimulusQuestions?: boolean;
}) => Promise<TDoc[]>;

export interface QuestionBankConfig<TDoc extends PoolDocument, TCached> {
	logScope: string;
	countActive: (course: string, unit: string, allowStimulusQuestions?: boolean) => Promise<number>;
	findRandom: PoolQuery<TDoc>;
	findRandomBatch?: PoolBatchQuery<TDoc>;
	serveCached: (doc: TDoc) => Promise<TCached> | TCached;
	/** Request asynchronous population when the bucket is empty. */
	requestRefill?: (course: string, unit: string) => Promise<void>;
	resolveAllowStimulusQuestions?: () => Promise<boolean> | boolean;
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
	/** Only authenticated callers may schedule a refill after a pool miss. */
	allowRefill?: boolean;
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
	course: string;
	unit: string;
	excludeQuestionIds: string[];
	pivot?: number;
	onDatabaseInit?: (elapsedMs: number) => void;
	allowStimulusQuestions?: boolean;
}): Promise<TDoc | null> {
	const pivot = opts.pivot ?? Math.random();
	const first = await opts.findRandom({
		course: opts.course,
		unit: opts.unit,
		excludeQuestionIds: opts.excludeQuestionIds,
		pivot,
		fromPivot: 'after',
		onDatabaseInit: opts.onDatabaseInit,
		allowStimulusQuestions: opts.allowStimulusQuestions
	});
	if (first) return first;

	return opts.findRandom({
		course: opts.course,
		unit: opts.unit,
		excludeQuestionIds: opts.excludeQuestionIds,
		pivot,
		fromPivot: 'before',
		onDatabaseInit: opts.onDatabaseInit,
		allowStimulusQuestions: opts.allowStimulusQuestions
	});
}

/**
 * A configured Question Bank owns selection, exclusions, warming, metrics, and
 * refill scheduling. Type-specific modules only provide storage and rendering
 * adapters, so adding a new bank does not require copying this lifecycle.
 */
export class QuestionBank<TDoc extends PoolDocument, TCached> {
	constructor(private readonly config: QuestionBankConfig<TDoc, TCached>) {}

	private async resolveAllowStimulusQuestions(): Promise<boolean | undefined> {
		return this.config.resolveAllowStimulusQuestions
			? await this.config.resolveAllowStimulusQuestions()
			: undefined;
	}

	private async requestRefillAfterMiss(
		course: string,
		unit: string,
		allowRefill: boolean
	): Promise<void> {
		if (!this.config.requestRefill || !allowRefill) return;

		const refill = this.config.requestRefill(course, unit).catch((error) => {
			logger.warn(`[${this.config.logScope}] failed to enqueue refill`, {
				course,
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
		course: string,
		unit?: string,
		options: GetQuestionOptions = {}
	): Promise<PoolSelectionResult<TCached>> {
		const cacheUnit = unit?.trim() ?? '';
		const excludeQuestionIds = normalizeExcludedQuestionIds(options.excludeQuestionIds);
		const metrics = options.metrics;
		const pool = QUESTION_POOL_CONFIG;
		const allowStimulusQuestions = await this.resolveAllowStimulusQuestions();

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
				course: course,
				unit: cacheUnit,
				excludeQuestionIds,
				onDatabaseInit,
				allowStimulusQuestions
			});

			if (!doc && excludeQuestionIds.length) {
				const activeCount = await this.config.countActive(
					course,
					cacheUnit,
					allowStimulusQuestions
				);
				if (activeCount > 0) {
					exclusionsReset = true;
					doc = await selectRandomActiveDoc({
						findRandom: this.config.findRandom,
						course: course,
						unit: cacheUnit,
						excludeQuestionIds: [],
						onDatabaseInit,
						allowStimulusQuestions
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
				course,
				unit: cacheUnit
			});
			await this.requestRefillAfterMiss(course, cacheUnit, options.allowRefill === true);
			return { status: 'warming', retryAfterSeconds: pool.warmingRetryAfterSeconds };
		} catch (err) {
			if (metrics) {
				metrics.poolQueryMs = Date.now() - queryStarted;
				metrics.segment = 'pool_error';
			}
			logger.error(`[${this.config.logScope}] pool selection failed`, {
				course,
				unit: cacheUnit,
				error: err
			});
			return { status: 'failed', error: err };
		}
	}

	async getMany(
		course: string,
		unit?: string,
		count = 1,
		options: GetQuestionOptions = {}
	): Promise<
		| { status: 'found'; results: TCached[]; exclusionsReset: boolean }
		| Exclude<PoolSelectionResult<TCached>, { status: 'found' }>
	> {
		const cacheUnit = unit?.trim() ?? '';
		const requestedCount = Math.max(1, Math.floor(count));
		const excludeQuestionIds = normalizeExcludedQuestionIds(options.excludeQuestionIds);
		const metrics = options.metrics;
		const pool = QUESTION_POOL_CONFIG;
		const allowStimulusQuestions = await this.resolveAllowStimulusQuestions();

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
					course: course,
					unit: cacheUnit,
					excludeQuestionIds,
					pivot: Math.random(),
					limit: requestedCount,
					onDatabaseInit,
					allowStimulusQuestions
				});
			} else {
				docs = [];
				const seenIds = [...excludeQuestionIds];
				for (let index = 0; index < requestedCount; index += 1) {
					const doc = await selectRandomActiveDoc({
						findRandom: this.config.findRandom,
						course: course,
						unit: cacheUnit,
						excludeQuestionIds: seenIds,
						onDatabaseInit,
						allowStimulusQuestions
					});
					if (!doc) break;
					docs.push(doc);
					if (doc.questionId) seenIds.push(doc.questionId);
				}
			}

			if (docs.length < requestedCount && excludeQuestionIds.length) {
				const activeCount = await this.config.countActive(
					course,
					cacheUnit,
					allowStimulusQuestions
				);
				if (activeCount > 0) {
					exclusionsReset = true;
					const selectedIds = docs
						.map((doc) => doc.questionId)
						.filter((id): id is string => Boolean(id));
					const moreDocs = this.config.findRandomBatch
						? await this.config.findRandomBatch({
								course: course,
								unit: cacheUnit,
								excludeQuestionIds: [...selectedIds],
								pivot: Math.random(),
								limit: requestedCount - docs.length,
								onDatabaseInit,
								allowStimulusQuestions
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
				course,
				unit: cacheUnit
			});
			await this.requestRefillAfterMiss(course, cacheUnit, options.allowRefill === true);
			return { status: 'warming', retryAfterSeconds: pool.warmingRetryAfterSeconds };
		} catch (err) {
			if (metrics) {
				metrics.poolQueryMs = Date.now() - queryStarted;
				metrics.segment = 'pool_error';
			}
			logger.error(`[${this.config.logScope}] pool selection failed`, {
				course,
				unit: cacheUnit,
				error: err
			});
			return { status: 'failed', error: err };
		}
	}
}
