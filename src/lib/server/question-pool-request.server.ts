import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { limitQuestionPoolRequests } from '$lib/server/api-rate-limit.server';
import {
	capturePathQuestionRequestMetric,
	createQuestionPathMetrics,
	type QuestionRequestErrorType,
	type QuestionRequestSegment
} from '$lib/server/question-request-metrics';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';

const MAX_QUESTION_REQUEST_BYTES = 16 * 1024;

export function createQuestionPoolRequest(request: Request) {
	const startedAt = Date.now();
	const path = createQuestionPathMetrics();
	let validationMs = 0;
	let course = '';
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
			course,
			unit,
			httpStatus: status,
			segment,
			cached,
			errorType
		});
	}

	async function prepare() {
		const rateLimit = await limitQuestionPoolRequests(request);
		if (!rateLimit.allowed) {
			const now = Date.now();
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil(Math.max(0, (rateLimit.retryAt ?? now) - now) / 1000)
			);
			recordMetric(429, 'error', false, 'validation');
			return {
				ok: false as const,
				response: json(
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
				)
			};
		}

		const validationStarted = Date.now();
		let body: unknown;
		try {
			body = await readJsonBody(request, MAX_QUESTION_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				recordMetric(413, 'error', false, 'validation');
				return {
					ok: false as const,
					response: json({ error: 'Request body is too large' }, { status: 413 })
				};
			}
			throw error;
		}

		const validated = validateQuestionRequest(body);
		validationMs = Date.now() - validationStarted;
		if (!validated.ok) {
			recordMetric(validated.response.status, 'error', false, 'validation');
			return { ok: false as const, response: validated.response };
		}

		course = validated.value.course;
		unit = validated.value.unit.trim();
		return { ok: true as const, body, value: validated.value };
	}

	return { path, recordMetric, prepare };
}

export function poolWarmingResponse(retryAfterSeconds: number): Response {
	return json(
		{
			code: 'POOL_WARMING',
			error: 'Question pool is warming up. Please retry shortly.',
			retryAfterSeconds
		},
		{ status: 503, headers: { 'Retry-After': String(retryAfterSeconds) } }
	);
}

export function poolUnavailableResponse(error: unknown): Response {
	return json(
		{
			code: 'POOL_UNAVAILABLE',
			error: 'Question pool temporarily unavailable',
			details: dev ? (error instanceof Error ? error.message : String(error)) : undefined
		},
		{ status: 503 }
	);
}

export function questionRequestFailureResponse(error: unknown, message: string): Response {
	const details = dev
		? error instanceof Error
			? error.message
			: String(error)
		: 'Internal server error';
	return json({ error: message, details }, { status: 500 });
}
