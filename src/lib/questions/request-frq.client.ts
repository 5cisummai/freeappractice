import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api';
import {
	QuestionRequestError,
	questionSourceFromCachedFlag,
	type QuestionSource
} from '$lib/client/activation-analytics';
import { isPoolWarmingResponse, type QuestionApiResponse } from '$lib/questions/payload';
import { PoolWarmingError } from '$lib/questions/request-mcq.client';
import type { PublicFrqQuestion } from '$lib/frq/types';

export type FrqFetchResult = {
	question: PublicFrqQuestion;
	source: QuestionSource;
	latencyMs: number;
	exclusionsReset: boolean;
};

type FrqQuestionApiResponse = QuestionApiResponse & {
	question?: PublicFrqQuestion;
};

/** Load one FRQ from POST /api/question/frq with shared warming/error shaping. */
export async function requestFrqQuestion(
	className: string,
	unit: string,
	excludeQuestionIds: string[] = []
): Promise<FrqFetchResult> {
	const startedAt = Date.now();
	const body: Record<string, string | string[]> = { className, unit };
	if (excludeQuestionIds.length) body.excludeQuestionIds = excludeQuestionIds;

	try {
		const response = await apiFetch('/api/question/frq', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		const payload = await readJsonOrNull<FrqQuestionApiResponse>(response);
		if (isPoolWarmingResponse(payload)) {
			throw new PoolWarmingError(
				payload.error || 'Written-response pool is warming up. Please retry shortly.',
				Math.max(1, Math.floor(payload.retryAfterSeconds))
			);
		}
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
			exclusionsReset: payload.exclusionsReset === true
		};
	} catch (error) {
		if (error instanceof QuestionRequestError) throw error;
		throw new QuestionRequestError(
			error instanceof Error ? error.message : 'Could not load written-response practice.',
			null
		);
	}
}
