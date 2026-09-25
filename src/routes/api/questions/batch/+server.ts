import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mcqBank } from '$lib/question-bank/mcq/bank.server';
import { logger } from '$lib/server/logger';
import {
	createQuestionPoolRequest,
	poolWarmingResponse,
	poolUnavailableResponse,
	questionRequestFailureResponse
} from '$lib/server/question-pool-request.server';

const MAX_QUESTION_BATCH_COUNT = 10;

/** Batch-only selection path — no synchronous LLM generation. */
export const config = {
	maxDuration: 15
};

export const POST: RequestHandler = async ({ request }) => {
	const { path, recordMetric, prepare } = createQuestionPoolRequest(request);

	try {
		const prepared = await prepare();
		if (!prepared.ok) return prepared.response;

		const rawCount = (prepared.body as Record<string, unknown>).count;
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

		const { course, unit: requestedUnit, excludeQuestionIds } = prepared.value;
		const outcome = await mcqBank.getMany(course, requestedUnit, rawCount, {
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
				return poolWarmingResponse(outcome.retryAfterSeconds);
			case 'failed':
				logger.error('Question batch selection failed', { error: outcome.error });
				recordMetric(503, 'pool_error', false, 'unknown');
				return poolUnavailableResponse(outcome.error);
			default: {
				const _exhaustive: never = outcome;
				return _exhaustive;
			}
		}
	} catch (err) {
		logger.error('Question batch request error', { error: err });
		recordMetric(500, 'error', false, 'unknown');
		return questionRequestFailureResponse(err, 'Failed to load questions');
	}
};
