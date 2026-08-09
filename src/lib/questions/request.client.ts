import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api';
import {
	QuestionRequestError,
	questionSourceFromCachedFlag,
	type QuestionSource
} from '$lib/client/activation-analytics';
import { isPoolWarmingResponse, type QuestionApiResponse } from '$lib/questions/payload';

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
