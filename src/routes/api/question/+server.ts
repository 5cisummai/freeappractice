import type { RequestHandler } from './$types';
import { mcqBank } from '#lib/question-bank/mcq/bank.server.js';
import { logger } from '#lib/server/logger.js';
import {
	createQuestionPoolRequest,
	poolWarmingResponse,
	poolUnavailableResponse,
	questionRequestFailureResponse
} from '#lib/server/question-pool-request.server.js';

/** Selection-only path — no synchronous LLM generation. */
export const config = {
	maxDuration: 15
};

export const POST: RequestHandler = async ({ request }) => {
	const { path, recordMetric, prepare } = createQuestionPoolRequest(request);

	try {
		const prepared = await prepare();
		if (!prepared.ok) return prepared.response;

		const { course, unit: requestedUnit, excludeQuestionIds } = prepared.value;
		const outcome = await mcqBank.get(course, requestedUnit, {
			excludeQuestionIds,
			metrics: path
		});

		switch (outcome.status) {
			case 'found':
				recordMetric(200, path.segment ?? 'pool_hit', outcome.result.cached ?? true);
				return Response.json({
					answer: outcome.result.answer,
					provider: outcome.result.provider,
					model: outcome.result.model,
					cached: outcome.result.cached ?? true,
					questionId: outcome.result.questionId,
					exclusionsReset: outcome.exclusionsReset
				});
			case 'warming':
				recordMetric(503, 'pool_warming', false, 'busy');
				return poolWarmingResponse(outcome.retryAfterSeconds);
			case 'failed':
				logger.error('Question pool selection failed', { error: outcome.error });
				recordMetric(503, 'pool_error', false, 'unknown');
				return poolUnavailableResponse(outcome.error);
			default: {
				const _exhaustive: never = outcome;
				return _exhaustive;
			}
		}
	} catch (err) {
		logger.error('Question request error', { error: err });
		recordMetric(500, 'error', false, 'unknown');
		return questionRequestFailureResponse(err, 'Failed to load question');
	}
};
