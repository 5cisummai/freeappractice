import { requestQuestion, type QuestionRequestResult } from '$lib/questions/request.client';
import { parseQuestionPayloadFromResponse } from '$lib/questions/payload';
import type { GeneratedQuestion } from '$lib/questions/types';

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
