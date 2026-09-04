import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { mcqBank } from '$lib/question-bank/mcq/bank.server';
import { normalizeUnit } from '$lib/question-bank/util.server';
import { logger } from '$lib/server/logger';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import {
	capturePathQuestionRequestMetric,
	createQuestionPathMetrics,
	type QuestionRequestErrorType,
	type QuestionRequestSegment
} from '$lib/server/question-request-metrics';
import { limitQuestionPoolRequests } from '$lib/server/api-rate-limit.server';

const MAX_QUESTION_BATCH_COUNT = 10;
const MAX_QUESTION_REQUEST_BYTES = 16 * 1024;

/** Batch-only selection path — no synchronous LLM generation. */
export const config = {
	maxDuration: 15,
	split: true
};

export const POST: RequestHandler = async ({ request }) => {
	const startedAt = Date.now();
	const path = createQuestionPathMetrics();
	let validationMs = 0;
	let apClass = '';
	let unit = '';

	function recordMetric(
		status: number,
		segment: QuestionRequestSegment,
		cached: boolean,
		errorType?: QuestionRequestErrorType
	): void {
		capturePathQuestionRequestMetric({
			path,
			startedAt,
			validationMs,
			apClass,
			unit,
			httpStatus: status,
			segment,
			cached,
			errorType
		});
	}

	try {
		const rateLimit = await limitQuestionPoolRequests(request);
		if (!rateLimit.allowed) {
			const now = Date.now();
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil(Math.max(0, (rateLimit.retryAt ?? now) - now) / 1000)
			);
			recordMetric(429, 'error', false, 'validation');
			return json(
				{ error: 'Too many requests', retryAfterSeconds },
				{
					status: 429,
					headers: {
						'RateLimit-Limit': String(rateLimit.limit),
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': String(retryAfterSeconds),
						'Retry-After': String(retryAfterSeconds)
					}
				}
			);
		}

		const validationStarted = Date.now();
		let body: unknown;
		try {
			body = await readJsonBody(request, MAX_QUESTION_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				recordMetric(413, 'error', false, 'validation');
				return json({ error: 'Request body is too large' }, { status: 413 });
			}
			throw error;
		}

		const validated = validateQuestionRequest(body);
		validationMs = Date.now() - validationStarted;
		if (!validated.ok) {
			recordMetric(validated.response.status, 'error', false, 'validation');
			return validated.response;
		}

		const rawCount = (body as Record<string, unknown>).count;
		if (
			typeof rawCount !== 'number' ||
			!Number.isInteger(rawCount) ||
			rawCount < 1 ||
			rawCount > MAX_QUESTION_BATCH_COUNT
		) {
			recordMetric(400, 'error', false, 'validation');
			return json(
				{ error: `count must be an integer from 1 to ${MAX_QUESTION_BATCH_COUNT}` },
				{ status: 400 }
			);
		}

		const { className, unit: requestedUnit, excludeQuestionIds } = validated.value;
		apClass = className;
		unit = normalizeUnit(requestedUnit);
		const outcome = await mcqBank.getMany(className, requestedUnit, rawCount, {
			excludeQuestionIds,
			metrics: path
		});

		switch (outcome.status) {
			case 'found':
				recordMetric(200, path.segment ?? 'pool_hit', true);
				return json({
					questions: outcome.results.map((result) => ({
						answer: result.answer,
						provider: result.provider,
						model: result.model,
						cached: result.cached,
						questionId: result.questionId
					})),
					exclusionsReset: outcome.exclusionsReset
				});
			case 'warming':
				recordMetric(503, 'pool_warming', false, 'busy');
				return json(
					{
						code: 'POOL_WARMING',
						error: 'Question pool is warming up. Please retry shortly.',
						retryAfterSeconds: outcome.retryAfterSeconds
					},
					{
						status: 503,
						headers: { 'Retry-After': String(outcome.retryAfterSeconds) }
					}
				);
			case 'failed':
				logger.error('Question batch selection failed', { error: outcome.error });
				recordMetric(503, 'pool_error', false, 'unknown');
				return json(
					{
						code: 'POOL_UNAVAILABLE',
						error: 'Question pool temporarily unavailable',
						details: dev
							? outcome.error instanceof Error
								? outcome.error.message
								: String(outcome.error)
							: undefined
					},
					{ status: 503 }
				);
			default: {
				const _exhaustive: never = outcome;
				return _exhaustive;
			}
		}
	} catch (err) {
		logger.error('Question batch request error', { error: err });
		recordMetric(500, 'error', false, 'unknown');
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to load questions', details }, { status: 500 });
	}
};
