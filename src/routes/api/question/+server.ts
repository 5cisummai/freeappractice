import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuestion } from '$lib/questions/cache.server';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { normalizeUnit } from '$lib/questions/util.server';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';
import {
	classifyQuestionRequestError,
	createQuestionPathMetrics,
	capturePathQuestionRequestMetric,
	type QuestionRequestErrorType,
	type QuestionRequestSegment
} from '$lib/server/question-request-metrics';

/** Selection-only path — no synchronous LLM generation. */
export const config = {
	maxDuration: 15
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
		const validationStarted = Date.now();
		const validated = validateQuestionRequest(await request.json());
		validationMs = Date.now() - validationStarted;
		if (!validated.ok) {
			recordMetric(validated.response.status, 'error', false, 'validation');
			return validated.response;
		}

		const { className, unit: requestedUnit, excludeQuestionIds } = validated.value;
		apClass = className;
		unit = normalizeUnit(requestedUnit);
		const outcome = await getQuestion(className, requestedUnit, {
			excludeQuestionIds,
			metrics: path
		});

		switch (outcome.status) {
			case 'found':
				recordMetric(200, path.segment ?? 'pool_hit', outcome.result.cached ?? true);
				return json({
					answer:
						typeof outcome.result.answer === 'object'
							? JSON.stringify(outcome.result.answer)
							: outcome.result.answer,
					provider: outcome.result.provider,
					model: outcome.result.model,
					cached: outcome.result.cached ?? true,
					questionId: outcome.result.questionId,
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
				logger.error('Question pool selection failed', { error: outcome.error });
				recordMetric(503, 'pool_error', false, classifyQuestionRequestError(outcome.error));
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
		logger.error('Question request error', { error: err });
		recordMetric(500, 'error', false, classifyQuestionRequestError(err));
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to load question', details }, { status: 500 });
	}
};
