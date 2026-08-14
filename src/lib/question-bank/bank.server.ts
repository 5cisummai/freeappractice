import type { GetQuestionOptions, PoolSelectionResult } from '$lib/question-bank/runtime.server';

export type QuestionBankName = 'mcq' | 'frq';

type BankRequest = {
	apClass: string;
	unit?: string;
	options?: GetQuestionOptions;
};

type McqBankModule = typeof import('$lib/question-bank/mcq/bank.server');
type FrqBankModule = typeof import('$lib/question-bank/frq/bank.server');

export type McqBankResult = Awaited<ReturnType<McqBankModule['getQuestion']>>;
export type FrqBankResult = Awaited<ReturnType<FrqBankModule['getFrqQuestion']>>;

export type QuestionBankResult =
	{ kind: 'mcq'; outcome: McqBankResult } | { kind: 'frq'; outcome: FrqBankResult };

export type QuestionBankHandle<TOutcome> = {
	readonly name: QuestionBankName;
	get: (params: BankRequest) => Promise<TOutcome>;
};

/**
 * The request-path interface for the Question Bank feature.
 *
 * This facade intentionally imports only selection services. Refill, generation,
 * inventory, and quality review stay behind worker-only operations modules so a
 * normal question request does not initialize those dependencies.
 */
export type QuestionBankDirectoryApi = {
	get(params: BankRequest & { kind?: 'mcq' }): Promise<{ kind: 'mcq'; outcome: McqBankResult }>;
	get(params: BankRequest & { kind: 'frq' }): Promise<{ kind: 'frq'; outcome: FrqBankResult }>;
	get(params: BankRequest & { kind?: 'mcq' | 'frq' }): Promise<QuestionBankResult>;
	getBank(name: 'mcq'): QuestionBankHandle<McqBankResult>;
	getBank(name: 'frq'): QuestionBankHandle<FrqBankResult>;
};

/** Public directory for the configured MCQ and FRQ banks. */
export class QuestionBankDirectory implements QuestionBankDirectoryApi {
	getBank(name: 'mcq'): QuestionBankHandle<McqBankResult>;
	getBank(name: 'frq'): QuestionBankHandle<FrqBankResult>;
	getBank(name: QuestionBankName): QuestionBankHandle<McqBankResult | FrqBankResult> {
		return {
			name,
			get: async (params) => (await this.get({ ...params, kind: name })).outcome
		} as QuestionBankHandle<McqBankResult | FrqBankResult>;
	}

	get(params: BankRequest & { kind?: 'mcq' }): Promise<{ kind: 'mcq'; outcome: McqBankResult }>;
	get(params: BankRequest & { kind: 'frq' }): Promise<{ kind: 'frq'; outcome: FrqBankResult }>;
	get(params: BankRequest & { kind?: 'mcq' | 'frq' }): Promise<QuestionBankResult>;
	async get(params: BankRequest & { kind?: 'mcq' | 'frq' }): Promise<QuestionBankResult> {
		if (params.kind === 'frq') {
			const { getFrqQuestion } = await import('$lib/question-bank/frq/bank.server');
			const outcome = await getFrqQuestion(params.apClass, params.unit, params.options);
			return { kind: 'frq', outcome };
		}
		const { getQuestion } = await import('$lib/question-bank/mcq/bank.server');
		const outcome = await getQuestion(params.apClass, params.unit, params.options);
		return { kind: 'mcq', outcome };
	}
}

export const questionBank = new QuestionBankDirectory();

export type { GetQuestionOptions, PoolSelectionResult };
