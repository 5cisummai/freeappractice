import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	QUESTION_REQUEST_EVENT,
	classifyQuestionRequestError,
	sanitizeQuestionRequestMetricProps,
	type QuestionRequestMetricProps
} from './question-request-metrics.ts';

describe('question-request-metrics', () => {
	it('exports the stable event name', () => {
		assert.equal(QUESTION_REQUEST_EVENT, 'question_request');
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

		assert.deepEqual(sanitized, {
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
		assert.equal('question_body' in sanitized, false);
		assert.equal('user_id' in sanitized, false);
		assert.equal('customTopic' in sanitized, false);
	});

	it('classifies busy vs generation errors without leaking messages', () => {
		assert.equal(
			classifyQuestionRequestError(new Error('Question generation is busy. Please retry.')),
			'busy'
		);
		assert.equal(
			classifyQuestionRequestError(new Error('Failed to persist generated question')),
			'generation'
		);
		assert.equal(classifyQuestionRequestError(new Error('boom')), 'unknown');
	});
});
