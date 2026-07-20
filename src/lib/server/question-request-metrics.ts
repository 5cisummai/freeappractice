import type { QuestionPathMetrics } from '$lib/questions/pool.server';
import { QuestionBusyError, QuestionGenerationError } from '$lib/questions/question-errors.server';
import type { QuestionFailureKind } from '$lib/question-failure';
import { captureAnonymousServerMetric } from '$lib/server/posthog';

/** Outcome segments for question request reliability dashboards. */
export type QuestionRequestSegment = 'pool_hit' | 'pool_warming' | 'pool_error' | 'error';

/** Server-side subset of QuestionFailureKind (no client-only `network`). */
export type QuestionRequestErrorType = Exclude<QuestionFailureKind, 'network'>;

export const QUESTION_REQUEST_EVENT = 'question_request';

/** Cron / worker snapshot for pool readiness and refill health dashboards. */
export const QUESTION_POOL_HEALTH_EVENT = 'question_pool_health';

export type QuestionPoolHealthMetricProps = {
	processed: number;
	generated: number;
	skipped_duplicates: number;
	failed: number;
	budget_remaining: number;
	stopped_reason: string;
	empty_observed_buckets: number;
	failed_jobs: number;
	budget_exhausted_jobs: number;
	pending_jobs: number;
	oldest_job_age_ms: number;
};

export type QuestionRequestMetricProps = {
	question_type: 'mcq' | 'frq';
	segment: QuestionRequestSegment;
	ap_class: string;
	unit: string;
	validation_ms: number;
	db_connect_ms: number;
	pool_query_ms: number;
	/** Transitional alias: db_connect_ms + pool_query_ms. */
	cache_lookup_ms: number;
	lock_wait_ms: number;
	generation_ms: number;
	persistence_ms: number;
	total_ms: number;
	http_status: number;
	ok: boolean;
	cached: boolean;
	error_type?: QuestionRequestErrorType;
};

const ALLOWED_PROP_KEYS = new Set<keyof QuestionRequestMetricProps>([
	'question_type',
	'segment',
	'ap_class',
	'unit',
	'validation_ms',
	'db_connect_ms',
	'pool_query_ms',
	'cache_lookup_ms',
	'lock_wait_ms',
	'generation_ms',
	'persistence_ms',
	'total_ms',
	'http_status',
	'ok',
	'cached',
	'error_type'
]);

/** Strip anything outside the allowlist (defense in depth — no bodies / user IDs). */
export function sanitizeQuestionRequestMetricProps(
	props: QuestionRequestMetricProps
): Record<string, string | number | boolean> {
	const out: Record<string, string | number | boolean> = {};
	for (const key of ALLOWED_PROP_KEYS) {
		const value = props[key];
		if (value === undefined) continue;
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			out[key] = value;
		}
	}
	return out;
}

export function classifyQuestionRequestError(err: unknown): QuestionRequestErrorType {
	if (err instanceof QuestionBusyError) return 'busy';
	if (err instanceof QuestionGenerationError) return 'generation';
	return 'unknown';
}

function captureQuestionRequestMetric(props: QuestionRequestMetricProps): void {
	captureAnonymousServerMetric(QUESTION_REQUEST_EVENT, sanitizeQuestionRequestMetricProps(props));
}

export function createQuestionPathMetrics(
	questionType: QuestionPathMetrics['questionType'] = 'mcq'
): QuestionPathMetrics {
	return {
		questionType,
		dbConnectMs: 0,
		poolQueryMs: 0,
		cacheLookupMs: 0,
		lockWaitMs: 0,
		generationMs: 0,
		persistenceMs: 0
	};
}

/** Build + capture a metric from path timings and common request fields. */
export function capturePathQuestionRequestMetric(opts: {
	path: QuestionPathMetrics;
	startedAt: number;
	validationMs: number;
	apClass: string;
	unit: string;
	httpStatus: number;
	segment: QuestionRequestSegment;
	cached: boolean;
	errorType?: QuestionRequestErrorType;
}): void {
	captureQuestionRequestMetric({
		question_type: opts.path.questionType,
		segment: opts.segment,
		ap_class: opts.apClass,
		unit: opts.unit,
		validation_ms: opts.validationMs,
		db_connect_ms: opts.path.dbConnectMs,
		pool_query_ms: opts.path.poolQueryMs,
		cache_lookup_ms: opts.path.cacheLookupMs || opts.path.dbConnectMs + opts.path.poolQueryMs,
		lock_wait_ms: opts.path.lockWaitMs,
		generation_ms: opts.path.generationMs,
		persistence_ms: opts.path.persistenceMs,
		total_ms: Date.now() - opts.startedAt,
		http_status: opts.httpStatus,
		ok: opts.httpStatus < 400,
		cached: opts.cached,
		...(opts.errorType ? { error_type: opts.errorType } : {})
	});
}

const POOL_HEALTH_PROP_KEYS = new Set<keyof QuestionPoolHealthMetricProps>([
	'processed',
	'generated',
	'skipped_duplicates',
	'failed',
	'budget_remaining',
	'stopped_reason',
	'empty_observed_buckets',
	'failed_jobs',
	'budget_exhausted_jobs',
	'pending_jobs',
	'oldest_job_age_ms'
]);

/** Strip anything outside the pool-health allowlist (no bucket names / error strings). */
export function sanitizeQuestionPoolHealthMetricProps(
	props: QuestionPoolHealthMetricProps
): Record<string, string | number | boolean> {
	const out: Record<string, string | number | boolean> = {};
	for (const key of POOL_HEALTH_PROP_KEYS) {
		const value = props[key];
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			out[key] = value;
		}
	}
	return out;
}

/** Capture anonymous refill/readiness snapshot after a cron or admin worker run. */
export function captureQuestionPoolHealthMetric(props: QuestionPoolHealthMetricProps): void {
	captureAnonymousServerMetric(
		QUESTION_POOL_HEALTH_EVENT,
		sanitizeQuestionPoolHealthMetricProps(props)
	);
}
