import { describe, expect, it } from 'vitest';
import { QuestionBusyError, QuestionGenerationError } from '$lib/questions/question-errors.server';
import {
	QUESTION_POOL_HEALTH_EVENT,
	QUESTION_REQUEST_EVENT,
	classifyQuestionRequestError,
	sanitizeQuestionPoolHealthMetricProps,
	sanitizeQuestionRequestMetricProps,
	type QuestionRequestMetricProps
} from '$lib/server/question-request-metrics';

describe('question-request-metrics', () => {
	it('exports the stable event names', () => {
		expect(QUESTION_REQUEST_EVENT).toBe('question_request');
		expect(QUESTION_POOL_HEALTH_EVENT).toBe('question_pool_health');
	});

	it('allowlists only safe metric properties', () => {
		const props = {
			question_type: 'mcq',
			segment: 'pool_hit',
			ap_class: 'AP Biology',
			unit: 'Unit 1',
			validation_ms: 2,
			db_connect_ms: 5,
			pool_query_ms: 7,
			cache_lookup_ms: 12,
			lock_wait_ms: 0,
			generation_ms: 0,
			persistence_ms: 0,
			total_ms: 40,
			http_status: 200,
			ok: true,
			cached: true,
			error_type: undefined,
			question_body: 'secret stem',
			user_id: 'user_123',
			customTopic: 'mitochondria'
		} as QuestionRequestMetricProps & Record<string, unknown>;

		const sanitized = sanitizeQuestionRequestMetricProps(props as QuestionRequestMetricProps);

		expect(sanitized).toEqual({
			question_type: 'mcq',
			segment: 'pool_hit',
			ap_class: 'AP Biology',
			unit: 'Unit 1',
			validation_ms: 2,
			db_connect_ms: 5,
			pool_query_ms: 7,
			cache_lookup_ms: 12,
			lock_wait_ms: 0,
			generation_ms: 0,
			persistence_ms: 0,
			total_ms: 40,
			http_status: 200,
			ok: true,
			cached: true
		});
		expect('question_body' in sanitized).toBe(false);
		expect('user_id' in sanitized).toBe(false);
		expect('customTopic' in sanitized).toBe(false);
	});

	it('allowlists pool health snapshot properties', () => {
		const sanitized = sanitizeQuestionPoolHealthMetricProps({
			processed: 1,
			generated: 3,
			skipped_duplicates: 0,
			failed: 0,
			budget_remaining: 40,
			stopped_reason: 'complete',
			empty_observed_buckets: 1,
			failed_jobs: 0,
			budget_exhausted_jobs: 0,
			pending_jobs: 2,
			oldest_job_age_ms: 12_000
		});

		expect(sanitized.stopped_reason).toBe('complete');
		expect(sanitized.empty_observed_buckets).toBe(1);
		expect(sanitized.oldest_job_age_ms).toBe(12_000);
	});

	it('classifies typed errors without reading messages', () => {
		expect(classifyQuestionRequestError(new QuestionBusyError())).toBe('busy');
		expect(
			classifyQuestionRequestError(
				new QuestionGenerationError('Failed to persist generated question')
			)
		).toBe('generation');
		expect(classifyQuestionRequestError(new Error('boom'))).toBe('unknown');
	});
});
