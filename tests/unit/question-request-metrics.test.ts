import { describe, expect, it } from 'vitest';
import {
	QuestionBusyError,
	QuestionGenerationError
} from '$lib/questions/question-errors.server';
import {
	QUESTION_REQUEST_EVENT,
	classifyQuestionRequestError,
	sanitizeQuestionRequestMetricProps,
	type QuestionRequestMetricProps
} from '$lib/server/question-request-metrics';

describe('question-request-metrics', () => {
	it('exports the stable event name', () => {
		expect(QUESTION_REQUEST_EVENT).toBe('question_request');
	});

	it('allowlists only safe metric properties', () => {
		const props = {
			segment: 'cache_hit',
			ap_class: 'AP Biology',
			unit: 'Unit 1',
			validation_ms: 2,
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
			segment: 'cache_hit',
			ap_class: 'AP Biology',
			unit: 'Unit 1',
			validation_ms: 2,
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

	it('classifies typed errors without reading messages', () => {
		expect(classifyQuestionRequestError(new QuestionBusyError())).toBe('busy');
		expect(
			classifyQuestionRequestError(new QuestionGenerationError('Failed to persist generated question'))
		).toBe('generation');
		expect(classifyQuestionRequestError(new Error('boom'))).toBe('unknown');
	});
});
