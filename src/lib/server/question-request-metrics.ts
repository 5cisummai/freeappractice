import type { QuestionPathMetrics } from '$lib/questions/pool.server';
import {
	QuestionBusyError,
	QuestionGenerationError
} from '$lib/questions/question-errors.server';
import { captureAnonymousServerMetric } from '$lib/server/posthog';

/** Outcome segments for POST /api/question reliability dashboards. */
export type QuestionRequestSegment =
	| 'cache_hit'
	| 'cache_miss_leader'
	| 'cache_miss_follower'
	| 'error';

export type QuestionRequestErrorType = 'validation' | 'generation' | 'busy' | 'unknown';

export const QUESTION_REQUEST_EVENT = 'question_request';

export type QuestionRequestMetricProps = {
	question_type: 'mcq' | 'frq';
	segment: QuestionRequestSegment;
	ap_class: string;
	unit: string;
	validation_ms: number;
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

export function captureQuestionRequestMetric(props: QuestionRequestMetricProps): void {
	captureAnonymousServerMetric(
		QUESTION_REQUEST_EVENT,
		sanitizeQuestionRequestMetricProps(props)
	);
}

export function createQuestionPathMetrics(
	questionType: QuestionPathMetrics['questionType'] = 'mcq'
): QuestionPathMetrics {
	return {
		questionType,
		cacheLookupMs: 0,
		lockWaitMs: 0,
		generationMs: 0,
		persistenceMs: 0
	};
}
