import type { RequestHandler } from './$types';
import { validateQuestionRequest } from '#lib/question-bank/request.server.js';
import { limitQuestionPoolRequests } from '#lib/server/api-rate-limit.server.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';
import { isStimulusQuestionsEnabled } from '#lib/flags.js';
import {
	assembleMcqQuiz,
	QuizPoolWarmingError,
	resolveQuizUnits
} from '#lib/question-bank/mcq/quiz-assembler.server.js';
import { generatedQuestionToMcqAnswerBody } from '#lib/question-bank/mcq/public-payload.server.js';
import { requestPoolRefill } from '#lib/question-bank/pool-refill-queue.server.js';
import { logger } from '#lib/server/logger.js';

export const config = { maxDuration: 15 };

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_QUIZ_COUNT = 50;
const MAX_QUESTION_ID_LIST = 50;

function parseQuestionIdList(value: unknown, field: string): string[] | Response {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value)) {
		return Response.json({ error: `${field} must be an array of strings` }, { status: 400 });
	}
	if (value.length > MAX_QUESTION_ID_LIST) {
		return Response.json(
			{ error: `${field} must contain at most ${MAX_QUESTION_ID_LIST} entries` },
			{ status: 400 }
		);
	}
	const ids: string[] = [];
	for (const entry of value) {
		if (typeof entry !== 'string' || !entry.trim()) {
			return Response.json(
				{ error: `${field} must contain non-empty strings` },
				{ status: 400 }
			);
		}
		ids.push(entry.trim());
	}
	return ids;
}

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

async function requestQuizRefill(
	course: string,
	unit: string,
	unitRange?: readonly number[]
): Promise<boolean> {
	const units = resolveQuizUnits(course, unit, unitRange);
	if (!units.length) return false;
	const results = await Promise.allSettled(
		units.map((refillUnit) =>
			requestPoolRefill({ questionType: 'mcq', course: course, unit: refillUnit })
		)
	);
	return results.some((result) => result.status === 'fulfilled');
}

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	let requestBody: unknown;
	let requestedUnitRange: readonly number[] | undefined;
	try {
		const rateLimit = await limitQuestionPoolRequests(request);
		if (!rateLimit.allowed) {
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil(Math.max(0, (rateLimit.retryAt ?? Date.now()) - Date.now()) / 1000)
			);
			return Response.json(
				{ error: 'Too many requests', retryAfterSeconds },
				{ status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
			);
		}

		try {
			requestBody = await readJsonBody(request, MAX_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return Response.json({ error: 'Request body is too large' }, { status: 413 });
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
			return Response.json({ error: 'count must be an integer' }, { status: 400 });
		}
		const count = record.count === undefined ? 10 : record.count;
		if (!Number.isInteger(count) || count < 1 || count > MAX_QUIZ_COUNT) {
			return Response.json(
				{ error: `count must be an integer from 1 to ${MAX_QUIZ_COUNT}` },
				{ status: 400 }
			);
		}

		try {
			requestedUnitRange = parseUnitRange(record.unitRange);
		} catch (error) {
			return Response.json(
				{ error: error instanceof Error ? error.message : 'Invalid unitRange' },
				{ status: 400 }
			);
		}

		const focusQuestionIds = parseQuestionIdList(record.focusQuestionIds, 'focusQuestionIds');
		if (focusQuestionIds instanceof Response) return focusQuestionIds;
		const excludeQuestionIds = parseQuestionIdList(record.excludeQuestionIds, 'excludeQuestionIds');
		if (excludeQuestionIds instanceof Response) return excludeQuestionIds;

		const globalFlagEnabled = await isStimulusQuestionsEnabled();
		const result = await assembleMcqQuiz(
			{
				course: validated.value.course,
				unit: validated.value.unit,
				unitRange: requestedUnitRange,
				count,
				...(focusQuestionIds.length ? { focusQuestionIds } : {}),
				...(excludeQuestionIds.length ? { excludeQuestionIds } : {})
			},
			{ globalFlagEnabled }
		);

		return Response.json({
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
			const course = typeof record.course === 'string' ? record.course.trim() : '';
			const unit = typeof record.unit === 'string' ? record.unit.trim() : '';
			let refillRequested = false;
			if (event.locals.userId && course) {
				try {
					refillRequested = await requestQuizRefill(course, unit, requestedUnitRange);
				} catch (refillError) {
					logger.warn('Quiz pool refill request failed', { course, unit, refillError });
				}
			}
			// Some questions exist but not enough for the requested count → client error.
			// Empty pool stays 503 POOL_WARMING so clients can retry while refill runs.
			if (error.availableCount > 0) {
				return Response.json(
					{
						code: 'INSUFFICIENT_QUESTIONS',
						error: error.message,
						refillRequested,
						availableCount: error.availableCount
					},
					{ status: 400 }
				);
			}
			return Response.json(
				{
					code: 'POOL_WARMING',
					error: error.message,
					retryAfterSeconds: 20,
					refillRequested,
					availableCount: error.availableCount
				},
				{ status: 503, headers: { 'Retry-After': '20' } }
			);
		}
		logger.error('Quiz assembly failed', { error });
		return Response.json({ error: 'Failed to assemble quiz' }, { status: 500 });
	}
};
