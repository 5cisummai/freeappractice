import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuestion } from '$lib/questions/cache.server';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { normalizeUnit } from '$lib/questions/util.server';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';
import {
	captureQuestionRequestMetric,
	classifyQuestionRequestError,
	createQuestionPathMetrics,
	type QuestionRequestErrorType,
	type QuestionRequestSegment
} from '$lib/server/question-request-metrics';

/** Vercel serverless max duration (seconds); raise on Pro if AI generation exceeds default. */
export const config = {
	maxDuration: 60
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
		captureQuestionRequestMetric({
			segment,
			ap_class: apClass,
			unit,
			validation_ms: validationMs,
			cache_lookup_ms: path.cacheLookupMs,
			lock_wait_ms: path.lockWaitMs,
			generation_ms: path.generationMs,
			persistence_ms: path.persistenceMs,
			total_ms: Date.now() - startedAt,
			http_status: status,
			ok: status < 400,
			cached,
			...(errorType ? { error_type: errorType } : {})
		});
	}

	try {
		const validationStarted = Date.now();
		const body = await request.json();
		const validated = validateQuestionRequest(body);
		validationMs = Date.now() - validationStarted;
		if (!validated.ok) {
			recordMetric(validated.response.status, 'error', false, 'validation');
			return validated.response;
		}

		const { className, unit: requestedUnit, excludeQuestionIds } = validated.value;
		apClass = className;
		unit = normalizeUnit(requestedUnit);
		const result = await getQuestion(className, requestedUnit, {
			excludeQuestionIds,
			metrics: path
		});
		recordMetric(200, path.segment ?? 'error', result.cached ?? false);

		const answerStr =
			typeof result.answer === 'object' ? JSON.stringify(result.answer) : result.answer;

		return json({
			answer: answerStr,
			provider: result.provider,
			model: result.model,
			cached: result.cached ?? false,
			questionId: result.questionId
		});
	} catch (err) {
		logger.error('Generate question error', { error: err });
		recordMetric(500, 'error', false, classifyQuestionRequestError(err));
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to generate question', details }, { status: 500 });
	}
};
