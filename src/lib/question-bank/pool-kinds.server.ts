import type { PoolRefillQuestionType } from '#lib/question-bank/pool-refill-types.server.js';
import { frqPoolKind } from '#lib/question-bank/frq/adapter.server.js';
import { mcqPoolKind } from '#lib/question-bank/mcq/adapter.server.js';
import type { QuestionPoolConfig } from '#lib/question-bank/pool-constants.js';

export type PoolKindBucket = {
	questionType: PoolRefillQuestionType;
	course: string;
	unit: string;
};

export type PoolKindAdapter = {
	questionType: PoolRefillQuestionType;
	minimumGenerationHeadroomMs: number;
	listBuckets: () => PoolKindBucket[];
	countActive: (course: string, unit: string) => Promise<number>;
	countActiveByBucket: () => Promise<Map<string, number>>;
	targetFor: (input: {
		course: string;
		generationCountsByCourse?: Record<string, number>;
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
