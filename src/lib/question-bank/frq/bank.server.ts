import {
	findFrqQuestionByPool,
	countActiveFrqQuestions,
	toFrqQuestion,
	type IFrqQuestion
} from '$lib/question-bank/frq/model.server';
import {
	toPublicFrqQuestion,
	type FrqQuestion,
	type PublicFrqQuestion
} from '$lib/question-bank/frq/types';
import {
	QuestionBank,
	type GetQuestionOptions,
	type PoolSelectionResult
} from '$lib/question-bank/runtime.server';
import { normalizeUnit } from '$lib/question-bank/util.server';

type FrqServiceResult = {
	question: FrqQuestion;
	publicQuestion: PublicFrqQuestion;
	provider: string;
	model: string;
	questionId: string;
	cached: boolean;
};

export const frqBank = new QuestionBank<IFrqQuestion, FrqServiceResult>({
	questionType: 'frq',
	logScope: 'frq-pool',
	normalizeUnit,
	countActive: countActiveFrqQuestions,
	findRandom: findFrqQuestionByPool,
	serveCached: (doc) => {
		const question = toFrqQuestion(doc);
		return {
			question,
			publicQuestion: toPublicFrqQuestion(doc.questionId, question),
			provider: 'cache',
			model: 'cached',
			questionId: doc.questionId,
			cached: true
		};
	},
	requestRefill: async (apClass, unit) => {
		const { requestPoolRefill } = await import('$lib/question-bank/pool-refill-queue.server');
		return requestPoolRefill({ questionType: 'frq', apClass, unit });
	}
});

/** Selection-only FRQ serve. Never invokes LLM or generation. */
export async function getFrqQuestion(
	apClass: string,
	unit?: string,
	options?: GetQuestionOptions
): Promise<PoolSelectionResult<Omit<FrqServiceResult, 'question'> & { question?: FrqQuestion }>> {
	const outcome = await frqBank.get(apClass, unit, options);
	if (outcome.status !== 'found') return outcome;
	return {
		status: 'found',
		exclusionsReset: outcome.exclusionsReset,
		result: {
			publicQuestion: outcome.result.publicQuestion,
			provider: outcome.result.provider,
			model: outcome.result.model,
			questionId: outcome.result.questionId,
			cached: outcome.result.cached
		}
	};
}
