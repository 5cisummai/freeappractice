import type { AnswerResult, GeneratedQuestion } from '$lib/question-bank/mcq/types';

export type QuestionCardModel = {
	selectedCourse: string;
	selectedUnit: string;
	delivery:
		| {
				kind: 'unlimited';
				unitRange?: readonly number[];
				requestVersion: number;
				presetQuestionId?: string;
		  }
		| {
				kind: 'quiz';
				question: GeneratedQuestion | null;
				answer: AnswerResult | null;
				questionNumber: string;
		  };
};

export function unlimitedQuestionCardModel(input: {
	selectedCourse: string;
	selectedUnit: string;
	unitRange?: readonly number[];
	requestVersion: number;
	presetQuestionId?: string;
}): QuestionCardModel {
	return {
		selectedCourse: input.selectedCourse,
		selectedUnit: input.selectedUnit,
		delivery: {
			kind: 'unlimited',
			unitRange: input.unitRange,
			requestVersion: input.requestVersion,
			presetQuestionId: input.presetQuestionId
		}
	};
}

export function quizQuestionCardModel(input: {
	selectedCourse: string;
	selectedUnit: string;
	question: GeneratedQuestion | null;
	answer: AnswerResult | null;
	questionNumber: string;
}): QuestionCardModel {
	return {
		selectedCourse: input.selectedCourse,
		selectedUnit: input.selectedUnit,
		delivery: {
			kind: 'quiz',
			question: input.question,
			answer: input.answer,
			questionNumber: input.questionNumber
		}
	};
}
