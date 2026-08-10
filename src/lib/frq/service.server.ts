import { FRQ_GRADING_MODEL } from '$lib/ai/ai-models-config';
import { findFrqQuestionByPool, toFrqQuestion, type IFrqQuestion } from '$lib/frq/model.server';
import { toPublicFrqQuestion, type FrqQuestion, type PublicFrqQuestion } from '$lib/frq/types';
import {
	createQuestionPool,
	type GetQuestionOptions,
	type PoolSelectionResult
} from '$lib/questions/pool.server';
import { requestPoolRefill } from '$lib/questions/pool-refill-queue.server';
import { normalizeUnit } from '$lib/questions/util.server';

type FrqServiceResult = {
	question: FrqQuestion;
	publicQuestion: PublicFrqQuestion;
	provider: string;
	model: string;
	questionId: string;
	cached: boolean;
};

const frqPool = createQuestionPool<IFrqQuestion, FrqServiceResult>({
	questionType: 'frq',
	logScope: 'frq-pool',
	normalizeUnit,
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
	requestRefill: (apClass, unit) => requestPoolRefill({ questionType: 'frq', apClass, unit })
});

/** Selection-only FRQ serve. Never invokes LLM or generation. */
export async function getFrqQuestion(
	apClass: string,
	unit?: string,
	options?: GetQuestionOptions
): Promise<PoolSelectionResult<Omit<FrqServiceResult, 'question'> & { question?: FrqQuestion }>> {
	const outcome = await frqPool.getQuestion(apClass, unit, options);
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

export function getFrqGradingModel(): string {
	return FRQ_GRADING_MODEL;
}
