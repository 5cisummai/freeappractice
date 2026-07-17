import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { getFrqCourseProfile } from '$lib/frq/profiles.server';
import { getFrqQuestion } from '$lib/frq/service.server';
import { isFrqPracticeEnabled } from '$lib/flags';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import {
	captureQuestionRequestMetric,
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
		if (!(await isFrqPracticeEnabled())) {
			return json({ error: 'Written-response practice is not enabled' }, { status: 404 });
		}
		try {
			const validationStarted = Date.now();
			const validated = validateQuestionRequest(await event.request.json());
			validationMs = Date.now() - validationStarted;
			if (!validated.ok) {
				captureQuestionRequestMetric({
					question_type: path.questionType,
					segment: 'error',
					ap_class: apClass,
					unit,
					validation_ms: validationMs,
					cache_lookup_ms: 0,
					lock_wait_ms: 0,
					generation_ms: 0,
					persistence_ms: 0,
					total_ms: Date.now() - startedAt,
					http_status: validated.response.status,
					ok: false,
					cached: false,
					error_type: 'validation'
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
			captureQuestionRequestMetric({
				question_type: path.questionType,
				segment: path.segment ?? 'error',
				ap_class: apClass,
				unit,
				validation_ms: validationMs,
				cache_lookup_ms: path.cacheLookupMs,
				lock_wait_ms: path.lockWaitMs,
				generation_ms: path.generationMs,
				persistence_ms: path.persistenceMs,
				total_ms: Date.now() - startedAt,
				http_status: 200,
				ok: true,
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
			captureQuestionRequestMetric({
				question_type: path.questionType,
				segment: 'error',
				ap_class: apClass,
				unit,
				validation_ms: validationMs,
				cache_lookup_ms: path.cacheLookupMs,
				lock_wait_ms: path.lockWaitMs,
				generation_ms: path.generationMs,
				persistence_ms: path.persistenceMs,
				total_ms: Date.now() - startedAt,
				http_status: 500,
				ok: false,
				cached: false,
				error_type: 'unknown'
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
