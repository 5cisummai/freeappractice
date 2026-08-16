import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api';
import {
	QuestionRequestError,
	questionSourceFromCachedFlag,
	type QuestionSource
} from '$lib/client/activation-analytics';
import {
	isPoolWarmingResponse,
	parseQuestionPayloadFromResponse,
	type QuestionApiResponse
} from '$lib/question-bank/mcq/payload';
import type { PublicFrqQuestion } from '$lib/question-bank/frq/types';
import type { GeneratedQuestion } from '$lib/question-bank/mcq/types';

export class PoolWarmingError extends QuestionRequestError {
	readonly retryAfterSeconds: number;

	constructor(message: string, retryAfterSeconds: number) {
		super(message, 503);
		this.name = 'PoolWarmingError';
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

export type QuestionRequestResult<TQuestion> = {
	question: TQuestion;
	source: QuestionSource;
	latencyMs: number;
	exclusionsReset: boolean;
};

type QuestionRequestOptions<TQuestion> = {
	endpoint: string;
	className: string;
	unit: string;
	excludeQuestionIds?: string[];
	warmingMessage: string;
	errorMessage: string;
	parseQuestion: (payload: QuestionApiResponse) => TQuestion;
};

/** Fetch one question while keeping MCQ and FRQ transport behavior identical. */
export async function requestQuestion<TQuestion>(
	options: QuestionRequestOptions<TQuestion>
): Promise<QuestionRequestResult<TQuestion>> {
	const startedAt = Date.now();
	const body: Record<string, string | string[]> = {
		className: options.className,
		unit: options.unit
	};
	if (options.excludeQuestionIds?.length) body.excludeQuestionIds = options.excludeQuestionIds;

	try {
		const response = await apiFetch(options.endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const payload = await readJsonOrNull<QuestionApiResponse>(response);

		if (isPoolWarmingResponse(payload)) {
			throw new PoolWarmingError(
				payload.error || options.warmingMessage,
				Math.max(1, Math.floor(payload.retryAfterSeconds))
			);
		}
		if (!response.ok || !payload) {
			throw new QuestionRequestError(
				getResponseMessage(payload, options.errorMessage),
				response.ok ? null : response.status
			);
		}

		return {
			question: options.parseQuestion(payload),
			source: questionSourceFromCachedFlag(payload.cached),
			latencyMs: Date.now() - startedAt,
			exclusionsReset: payload.exclusionsReset === true
		};
	} catch (error) {
		if (error instanceof QuestionRequestError) throw error;
		throw new QuestionRequestError(
			error instanceof Error ? error.message : options.errorMessage,
			null
		);
	}
}

export type QuestionFetchResult = QuestionRequestResult<GeneratedQuestion>;

/** Load one MCQ from POST /api/question. */
export function requestMcqQuestion(
	className: string,
	unit: string,
	excludeQuestionIds: string[] = []
): Promise<QuestionFetchResult> {
	return requestQuestion({
		endpoint: '/api/question',
		className,
		unit,
		excludeQuestionIds,
		warmingMessage: 'Question pool is warming up. Please retry shortly.',
		errorMessage: 'Failed to load question.',
		parseQuestion: parseQuestionPayloadFromResponse
	});
}

/** Load one MCQ by canonical question id. */
export async function requestMcqQuestionById(questionId: string): Promise<QuestionFetchResult> {
	const startedAt = Date.now();
	const response = await apiFetch(`/api/question/by-id/${encodeURIComponent(questionId)}`);
	const payload = await readJsonOrNull<QuestionApiResponse>(response);
	if (!response.ok || !payload) {
		throw new QuestionRequestError(
			getResponseMessage(payload, 'Failed to load question.'),
			response.ok ? null : response.status
		);
	}
	return {
		question: parseQuestionPayloadFromResponse(payload),
		source: questionSourceFromCachedFlag(payload.cached),
		latencyMs: Date.now() - startedAt,
		exclusionsReset: false
	};
}

export type FrqFetchResult = QuestionRequestResult<PublicFrqQuestion>;

type FrqQuestionApiResponse = QuestionApiResponse & {
	question?: PublicFrqQuestion;
};

/** Load one FRQ from POST /api/question/frq. */
export function requestFrqQuestion(
	className: string,
	unit: string,
	excludeQuestionIds: string[] = []
): Promise<FrqFetchResult> {
	return requestQuestion({
		endpoint: '/api/question/frq',
		className,
		unit,
		excludeQuestionIds,
		warmingMessage: 'Written-response pool is warming up. Please retry shortly.',
		errorMessage: 'Could not load written-response practice.',
		parseQuestion: (payload) => {
			const question = (payload as FrqQuestionApiResponse).question;
			if (!question) throw new Error('Could not load written-response practice.');
			return question;
		}
	});
}

/** Load one FRQ by canonical question id. */
export async function requestFrqQuestionById(questionId: string): Promise<FrqFetchResult> {
	const startedAt = Date.now();
	const response = await apiFetch(`/api/question/frq/by-id/${encodeURIComponent(questionId)}`);
	const payload = await readJsonOrNull<FrqQuestionApiResponse>(response);
	if (!response.ok || !payload?.question) {
		throw new QuestionRequestError(
			getResponseMessage(payload, 'Could not load written-response practice.'),
			response.ok ? null : response.status
		);
	}
	return {
		question: payload.question,
		source: questionSourceFromCachedFlag(payload.cached),
		latencyMs: Date.now() - startedAt,
		exclusionsReset: false
	};
}
