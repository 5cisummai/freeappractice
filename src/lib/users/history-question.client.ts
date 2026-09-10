import { apiFetch, readJsonOrNull } from '$lib/client/api.js';
import type { McqAnswerBody } from '$lib/question-bank/mcq/types.js';

const MAX_CACHED_HISTORY_QUESTIONS = 100;
const questionCache = new Map<string, Promise<McqAnswerBody>>();

/** Share successful history-detail reads across table rows and repeated sheet openings. */
export function getHistoryMcqQuestion(questionId: string): Promise<McqAnswerBody> {
	const cached = questionCache.get(questionId);
	if (cached) return cached;

	const request = apiFetch(`/api/question/by-id/${encodeURIComponent(questionId)}`)
		.then(async (response) => {
			const payload = await readJsonOrNull<{ answer?: McqAnswerBody; error?: string }>(response);
			if (!response.ok || !payload?.answer) {
				throw new Error(
					response.status === 404
						? 'This question is no longer available in storage. Your attempt was still recorded.'
						: (payload?.error ?? 'Could not load this question.')
				);
			}
			return payload.answer;
		})
		.catch((error) => {
			questionCache.delete(questionId);
			throw error;
		});

	if (questionCache.size >= MAX_CACHED_HISTORY_QUESTIONS) {
		const oldest = questionCache.keys().next().value;
		if (oldest) questionCache.delete(oldest);
	}
	questionCache.set(questionId, request);
	return request;
}
