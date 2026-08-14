import type { PoolRefillQuestionType } from '$lib/question-bank/pool-refill-types.server';
import { frqPoolKind } from '$lib/question-bank/frq/adapter.server';
import { mcqPoolKind } from '$lib/question-bank/mcq/adapter.server';
import type { QuestionPoolConfig } from '$lib/question-bank/pool-constants';

export type PoolKindBucket = {
	questionType: PoolRefillQuestionType;
	apClass: string;
	unit: string;
};

export type PoolKindAdapter = {
	questionType: PoolRefillQuestionType;
	minimumGenerationHeadroomMs: number;
	listBuckets: () => PoolKindBucket[];
	countActive: (apClass: string, unit: string) => Promise<number>;
	countActiveByBucket: () => Promise<Map<string, number>>;
	targetFor: (input: {
		apClass: string;
		generationCountsByClass?: Record<string, number>;
		config?: QuestionPoolConfig;
	}) => number;
};

const adapters = {
	mcq: mcqPoolKind,
	frq: frqPoolKind
} satisfies Record<PoolRefillQuestionType, PoolKindAdapter>;

export function getPoolKindAdapter(questionType: PoolRefillQuestionType): PoolKindAdapter {
	return adapters[questionType];
}

export const POOL_QUESTION_TYPES = Object.freeze(Object.keys(adapters) as PoolRefillQuestionType[]);
