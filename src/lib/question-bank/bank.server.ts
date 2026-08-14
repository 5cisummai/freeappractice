import { getFrqQuestion } from '$lib/question-bank/frq/bank.server';
import { getQuestion } from '$lib/question-bank/mcq/bank.server';
import type { GetQuestionOptions, PoolSelectionResult } from '$lib/question-bank/runtime.server';

export type QuestionBankName = 'mcq' | 'frq';

type BankRequest = {
	apClass: string;
	unit?: string;
	options?: GetQuestionOptions;
};

export type McqBankResult = Awaited<ReturnType<typeof getQuestion>>;
export type FrqBankResult = Awaited<ReturnType<typeof getFrqQuestion>>;

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
	private readonly banks = {
		mcq: {
			name: 'mcq' as const,
			get: (params: BankRequest) => getQuestion(params.apClass, params.unit, params.options)
		},
		frq: {
			name: 'frq' as const,
			get: (params: BankRequest) => getFrqQuestion(params.apClass, params.unit, params.options)
		}
	};

	getBank(name: 'mcq'): QuestionBankHandle<McqBankResult>;
	getBank(name: 'frq'): QuestionBankHandle<FrqBankResult>;
	getBank(name: QuestionBankName): QuestionBankHandle<McqBankResult | FrqBankResult> {
		return (name === 'frq' ? this.banks.frq : this.banks.mcq) as QuestionBankHandle<
			McqBankResult | FrqBankResult
		>;
	}

	get(params: BankRequest & { kind?: 'mcq' }): Promise<{ kind: 'mcq'; outcome: McqBankResult }>;
	get(params: BankRequest & { kind: 'frq' }): Promise<{ kind: 'frq'; outcome: FrqBankResult }>;
	async get(params: BankRequest & { kind?: 'mcq' | 'frq' }): Promise<QuestionBankResult> {
		if (params.kind === 'frq') {
			const outcome = await this.banks.frq.get(params);
			return { kind: 'frq', outcome };
		}
		const outcome = await this.banks.mcq.get(params);
		return { kind: 'mcq', outcome };
	}
}

export const questionBank = new QuestionBankDirectory();

export type { GetQuestionOptions, PoolSelectionResult };
