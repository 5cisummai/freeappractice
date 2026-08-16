import type { PracticeVariant } from '$lib/practice/multi-attempt';
import type { AnswerResult, GeneratedQuestion } from '$lib/question-bank/mcq/types';

export type QuestionCardModel = {
	selectedClass: string;
	selectedUnit: string;
	delivery:
		| {
				kind: 'unlimited';
				unitRange?: readonly number[];
				requestVersion: number;
				presetQuestionId?: string;
				experiment?: {
					assignedVariant: PracticeVariant;
					experimentEnabled: boolean;
				};
		  }
		| {
				kind: 'quiz';
				question: GeneratedQuestion | null;
				answer: AnswerResult | null;
				questionNumber: string;
		  };
};

export function unlimitedQuestionCardModel(input: {
	selectedClass: string;
	selectedUnit: string;
	unitRange?: readonly number[];
	requestVersion: number;
	presetQuestionId?: string;
	experiment?: Extract<QuestionCardModel['delivery'], { kind: 'unlimited' }>['experiment'];
}): QuestionCardModel {
	return {
		selectedClass: input.selectedClass,
		selectedUnit: input.selectedUnit,
		delivery: {
			kind: 'unlimited',
			unitRange: input.unitRange,
			requestVersion: input.requestVersion,
			presetQuestionId: input.presetQuestionId,
			experiment: input.experiment
		}
	};
}

export function quizQuestionCardModel(input: {
	selectedClass: string;
	selectedUnit: string;
	question: GeneratedQuestion | null;
	answer: AnswerResult | null;
	questionNumber: string;
}): QuestionCardModel {
	return {
		selectedClass: input.selectedClass,
		selectedUnit: input.selectedUnit,
		delivery: {
			kind: 'quiz',
			question: input.question,
			answer: input.answer,
			questionNumber: input.questionNumber
		}
	};
}
