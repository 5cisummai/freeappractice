import { apiFetch, getResponseMessage, readJsonOrNull } from '$lib/client/api';
import {
	QuestionRequestError,
	questionSourceFromCachedFlag,
	type QuestionSource
} from '$lib/client/activation-analytics';
import {
	parseQuestionPayloadFromResponse,
	type QuestionApiResponse
} from '$lib/questions/payload';
import type { GeneratedQuestion } from '$lib/questions/types';

export type QuestionFetchResult = {
	question: GeneratedQuestion;
	source: QuestionSource;
	latencyMs: number;
};

/** Load one MCQ from POST /api/question with shared error/latency shaping. */
export async function requestMcqQuestion(
	className: string,
	unit: string,
	excludeQuestionIds: string[] = []
): Promise<QuestionFetchResult> {
	const startedAt = Date.now();
	const body: Record<string, string | string[]> = { className, unit };
	if (excludeQuestionIds.length) body.excludeQuestionIds = excludeQuestionIds;

	try {
		const response = await apiFetch('/api/question', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

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
			latencyMs: Date.now() - startedAt
		};
	} catch (error) {
		if (error instanceof QuestionRequestError) throw error;
		throw new QuestionRequestError(
			error instanceof Error ? error.message : 'Could not load question.',
			null
		);
	}
}
