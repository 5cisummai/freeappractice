import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { requireFrqPracticeEnabled } from '$lib/frq/gate.server';
import { getFrqCourseProfile } from '$lib/frq/profiles.server';
import { getFrqQuestion } from '$lib/frq/service.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import {
	capturePathQuestionRequestMetric,
	createQuestionPathMetrics
} from '$lib/server/question-request-metrics';

export const config = { maxDuration: 15 };

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const startedAt = Date.now();
		const path = createQuestionPathMetrics('frq');
		let apClass = '';
		let unit = '';
		let validationMs = 0;
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		try {
			const validationStarted = Date.now();
			const validated = validateQuestionRequest(await event.request.json());
			validationMs = Date.now() - validationStarted;
			if (!validated.ok) {
				capturePathQuestionRequestMetric({
					path,
					startedAt,
					validationMs,
					apClass,
					unit,
					httpStatus: validated.response.status,
					segment: 'error',
					cached: false,
					errorType: 'validation'
				});
				return validated.response;
			}
			({ className: apClass, unit } = validated.value);
			if (!getFrqCourseProfile(apClass)) {
				return json(
					{ error: 'Written-response practice is not available for this course' },
					{ status: 400 }
				);
			}
			const outcome = await getFrqQuestion(apClass, unit, {
				excludeQuestionIds: validated.value.excludeQuestionIds,
				metrics: path
			});

			switch (outcome.status) {
				case 'found': {
					capturePathQuestionRequestMetric({
						path,
						startedAt,
						validationMs,
						apClass,
						unit,
						httpStatus: 200,
						segment: path.segment ?? 'pool_hit',
						cached: outcome.result.cached
					});
					capturePostHogServerEvent(event.request, {
						distinctId: userId,
						event: 'frq_question_requested',
						properties: {
							request_source: 'authenticated_app',
							question_type: path.questionType,
							cache_outcome: 'hit',
							provider: outcome.result.provider,
							ap_class: apClass,
							unit,
							db_connect_ms: path.dbConnectMs,
							pool_query_ms: path.poolQueryMs
						}
					});
					return json({
						question: outcome.result.publicQuestion,
						questionId: outcome.result.questionId,
						provider: outcome.result.provider,
						model: outcome.result.model,
						cached: outcome.result.cached,
						exclusionsReset: outcome.exclusionsReset
					});
				}
				case 'warming': {
					capturePathQuestionRequestMetric({
						path,
						startedAt,
						validationMs,
						apClass,
						unit,
						httpStatus: 503,
						segment: 'pool_warming',
						cached: false,
						errorType: 'busy'
					});
					return json(
						{
							code: 'POOL_WARMING',
							error: 'Written-response pool is warming up. Please retry shortly.',
							retryAfterSeconds: outcome.retryAfterSeconds
						},
						{
							status: 503,
							headers: { 'Retry-After': String(outcome.retryAfterSeconds) }
						}
					);
				}
				case 'failed': {
					capturePathQuestionRequestMetric({
						path,
						startedAt,
						validationMs,
						apClass,
						unit,
						httpStatus: 503,
						segment: 'pool_error',
						cached: false,
						errorType: 'unknown'
					});
					return json(
						{
							code: 'POOL_UNAVAILABLE',
							error: 'Written-response pool temporarily unavailable'
						},
						{ status: 503 }
					);
				}
				default: {
					const _exhaustive: never = outcome;
					return _exhaustive;
				}
			}
		} catch (error) {
			capturePathQuestionRequestMetric({
				path,
				startedAt,
				validationMs,
				apClass,
				unit,
				httpStatus: 500,
				segment: 'error',
				cached: false,
				errorType: 'unknown'
			});
			capturePostHogServerEvent(event.request, {
				distinctId: userId,
				event: 'frq_question_failed',
				properties: {
					request_source: 'authenticated_app',
					question_type: path.questionType,
					ap_class: apClass,
					unit,
					latency_ms: Date.now() - startedAt,
					error_type: error instanceof Error ? error.name : 'unknown'
				}
			});
			throw error;
		}
	},
	{ logLabel: 'FRQ request error', errorMessage: 'Failed to load written-response practice' }
);
