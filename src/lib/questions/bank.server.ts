import { getFrqQuestion } from '$lib/frq/service.server';
import { getQuestion } from '$lib/questions/cache.server';
import type { GetQuestionOptions, PoolSelectionResult } from '$lib/questions/pool.server';

type BankRequest = {
	apClass: string;
	unit?: string;
	options?: GetQuestionOptions;
};

export type McqBankResult = Awaited<ReturnType<typeof getQuestion>>;
export type FrqBankResult = Awaited<ReturnType<typeof getFrqQuestion>>;

export type QuestionBankResult =
	{ kind: 'mcq'; outcome: McqBankResult } | { kind: 'frq'; outcome: FrqBankResult };

/**
 * The request-path interface for the Question Bank feature.
 *
 * This facade intentionally imports only selection services. Refill, generation,
 * inventory, and quality review stay behind worker-only operations modules so a
 * normal question request does not initialize those dependencies.
 */
export type QuestionBank = {
	get(params: BankRequest & { kind?: 'mcq' }): Promise<{ kind: 'mcq'; outcome: McqBankResult }>;
	get(params: BankRequest & { kind: 'frq' }): Promise<{ kind: 'frq'; outcome: FrqBankResult }>;
	get(params: BankRequest & { kind?: 'mcq' | 'frq' }): Promise<QuestionBankResult>;
};

async function getBankQuestion(
	params: BankRequest & { kind?: 'mcq' | 'frq' }
): Promise<QuestionBankResult> {
	if (params.kind === 'frq') {
		return {
			kind: 'frq',
			outcome: await getFrqQuestion(params.apClass, params.unit, params.options)
		};
	}
	return {
		kind: 'mcq',
		outcome: await getQuestion(params.apClass, params.unit, params.options)
	};
}

export const questionBank: QuestionBank = { get: getBankQuestion as QuestionBank['get'] };

export type { GetQuestionOptions, PoolSelectionResult };
