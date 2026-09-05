import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { limitQuestionPoolRequests } from '$lib/server/api-rate-limit.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { isStimulusQuestionsEnabled } from '$lib/flags';
import {
	assembleMcqQuiz,
	QuizPoolWarmingError,
	resolveQuizUnits
} from '$lib/question-bank/mcq/quiz-assembler.server';
import { generatedQuestionToMcqAnswerBody } from '$lib/question-bank/mcq/public-payload.server';
import { requestPoolRefill } from '$lib/question-bank/pool-refill-queue.server';
import { logger } from '$lib/server/logger';

export const config = { maxDuration: 15 };

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_QUIZ_COUNT = 50;

function parseUnitRange(value: unknown): readonly number[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (!Array.isArray(value) || value.length !== 2)
		throw new Error('unitRange must contain two numbers');
	const range = value.map((entry) => (typeof entry === 'number' ? Math.trunc(entry) : NaN));
	if (range.some((entry) => !Number.isFinite(entry) || entry < 0)) {
		throw new Error('unitRange must contain non-negative integers');
	}
	return range;
}

function unitsToRefill(className: string, unit: string, unitRange?: readonly number[]): string[] {
	return resolveQuizUnits(className, unit, unitRange);
}

async function requestQuizRefill(
	className: string,
	unit: string,
	unitRange?: readonly number[]
): Promise<boolean> {
	const units = unitsToRefill(className, unit, unitRange);
	if (!units.length) return false;
	const results = await Promise.allSettled(
		units.map((refillUnit) =>
			requestPoolRefill({ questionType: 'mcq', apClass: className, unit: refillUnit })
		)
	);
	return results.some((result) => result.status === 'fulfilled');
}

export const POST: RequestHandler = async ({ request }) => {
	let requestBody: unknown;
	let requestedUnitRange: readonly number[] | undefined;
	try {
		const rateLimit = await limitQuestionPoolRequests(request);
		if (!rateLimit.allowed) {
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil(Math.max(0, (rateLimit.retryAt ?? Date.now()) - Date.now()) / 1000)
			);
			return json(
				{ error: 'Too many requests', retryAfterSeconds },
				{ status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
			);
		}

		try {
			requestBody = await readJsonBody(request, MAX_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Request body is too large' }, { status: 413 });
			}
			throw error;
		}

		const record =
			requestBody && typeof requestBody === 'object'
				? (requestBody as Record<string, unknown>)
				: {};
		const validated = validateQuestionRequest(record);
		if (!validated.ok) return validated.response;
		if (record.count !== undefined && typeof record.count !== 'number') {
			return json({ error: 'count must be an integer' }, { status: 400 });
		}
		const count = record.count === undefined ? 10 : record.count;
		if (!Number.isInteger(count) || count < 1 || count > MAX_QUIZ_COUNT) {
			return json(
				{ error: `count must be an integer from 1 to ${MAX_QUIZ_COUNT}` },
				{ status: 400 }
			);
		}

		try {
			requestedUnitRange = parseUnitRange(record.unitRange);
		} catch (error) {
			return json(
				{ error: error instanceof Error ? error.message : 'Invalid unitRange' },
				{ status: 400 }
			);
		}

		const globalFlagEnabled = await isStimulusQuestionsEnabled();
		const result = await assembleMcqQuiz(
			{
				apClass: validated.value.className,
				unit: validated.value.unit,
				unitRange: requestedUnitRange,
				count
			},
			{ globalFlagEnabled }
		);

		return json({
			questions: result.questions.map((question) => ({
				answer: generatedQuestionToMcqAnswerBody(question),
				provider: 'cache',
				model: 'cached',
				cached: true,
				questionId: question.questionId
			})),
			metrics: result.metrics
		});
	} catch (error) {
		if (error instanceof QuizPoolWarmingError) {
			const record =
				requestBody && typeof requestBody === 'object'
					? (requestBody as Record<string, unknown>)
					: {};
			const className = typeof record.className === 'string' ? record.className.trim() : '';
			const unit = typeof record.unit === 'string' ? record.unit.trim() : '';
			let refillRequested = false;
			if (className) {
				try {
					refillRequested = await requestQuizRefill(className, unit, requestedUnitRange);
				} catch (refillError) {
					logger.warn('Quiz pool refill request failed', { className, unit, refillError });
				}
			}
			return json(
				{ code: 'POOL_WARMING', error: error.message, retryAfterSeconds: 20, refillRequested },
				{ status: 503, headers: { 'Retry-After': '20' } }
			);
		}
		logger.error('Quiz assembly failed', { error });
		return json({ error: 'Failed to assemble quiz' }, { status: 500 });
	}
};
