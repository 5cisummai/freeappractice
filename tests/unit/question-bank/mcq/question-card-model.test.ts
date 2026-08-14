import { describe, expect, it } from 'vitest';
import {
	quizQuestionCardModel,
	unlimitedQuestionCardModel
} from '$lib/question-bank/question-card-model';

describe('question card delivery models', () => {
	it('adapts unlimited delivery into the shared card model', () => {
		expect(
			unlimitedQuestionCardModel({
				selectedClass: 'AP Biology',
				selectedUnit: 'Unit 1',
				requestVersion: 2
			})
		).toMatchObject({
			selectedClass: 'AP Biology',
			delivery: { kind: 'unlimited', requestVersion: 2 }
		});
	});

	it('adapts quiz delivery into the same card model', () => {
		const question = { prompt: 'Stem', options: [], hasStimulus: false };
		expect(
			quizQuestionCardModel({
				selectedClass: 'AP Biology',
				selectedUnit: 'Unit 1',
				question,
				answer: null,
				questionNumber: '3'
			})
		).toMatchObject({
			selectedUnit: 'Unit 1',
			delivery: { kind: 'quiz', question, questionNumber: '3' }
		});
	});
});
