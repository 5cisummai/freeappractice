import { requestQuestion, type QuestionRequestResult } from '$lib/questions/request.client';
import type { PublicFrqQuestion } from '$lib/frq/types';
import type { QuestionApiResponse } from '$lib/questions/payload';

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
