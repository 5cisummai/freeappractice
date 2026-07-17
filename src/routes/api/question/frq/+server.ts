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

export const config = { maxDuration: 60 };

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
			const result = await getFrqQuestion(apClass, unit, {
				excludeQuestionIds: validated.value.excludeQuestionIds,
				metrics: path
			});
			capturePathQuestionRequestMetric({
				path,
				startedAt,
				validationMs,
				apClass,
				unit,
				httpStatus: 200,
				segment: path.segment ?? 'error',
				cached: result.cached
			});
			capturePostHogServerEvent(event.request, {
				distinctId: userId,
				event: 'frq_question_requested',
				properties: {
					request_source: 'authenticated_app',
					question_type: path.questionType,
					cache_outcome: result.cached ? 'hit' : 'miss',
					provider: result.provider,
					ap_class: apClass,
					unit,
					cache_lookup_ms: path.cacheLookupMs,
					lock_wait_ms: path.lockWaitMs,
					generation_ms: path.generationMs,
					persistence_ms: path.persistenceMs
				}
			});
			return json({
				question: result.publicQuestion,
				questionId: result.questionId,
				provider: result.provider,
				model: result.model,
				cached: result.cached
			});
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
