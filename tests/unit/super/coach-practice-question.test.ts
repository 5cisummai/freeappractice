import { describe, expect, it } from 'vitest';
import {
	buildCoachPracticeQuestionToolOutput,
	getCoachPracticeQuestionToolInput,
	getCoachPracticeQuestionToolOutput
} from '$lib/super/coach-practice-question';
import { isSuperAgentToolContinuation, lastSuperAgentUserText } from '$lib/super/agent-request';

describe('coach practice question tool helpers', () => {
	it('parses tool input', () => {
		expect(
			getCoachPracticeQuestionToolInput({
				apClass: 'AP Physics 1',
				unit: 'Unit 1',
				mode: 'mcq'
			})
		).toEqual({
			apClass: 'AP Physics 1',
			unit: 'Unit 1',
			mode: 'mcq'
		});
	});

	it('builds answered MCQ tool output without the correct answer', () => {
		const output = buildCoachPracticeQuestionToolOutput({
			status: 'answered',
			question: {
				kind: 'practice_question',
				mode: 'mcq',
				questionId: 'mcq-1',
				apClass: 'AP Physics 1',
				unit: 'Unit 1',
				practiceHref: '/app/practice',
				prompt: 'What is velocity?'
			},
			answer: {
				questionNumber: '1',
				selectedAnswer: 'B',
				correctAnswer: 'B',
				isCorrect: true,
				timeTakenMs: 1200
			}
		});

		expect(output).toMatchObject({
			status: 'answered',
			selectedAnswer: 'B',
			isCorrect: true,
			timeTakenMs: 1200
		});
		expect(output).not.toHaveProperty('correctAnswer');
		expect(getCoachPracticeQuestionToolOutput(output)).toEqual(output);
	});
});

describe('super agent tool continuation', () => {
	it('detects continuation when the last assistant message has tool output', () => {
		expect(
			isSuperAgentToolContinuation([
				{
					role: 'user',
					parts: [{ type: 'text', text: 'Give me a practice question' }]
				},
				{
					role: 'assistant',
					parts: [
						{
							type: 'tool-give_practice_question',
							state: 'output-available',
							output: { status: 'answered', questionId: 'mcq-1' }
						}
					]
				}
			])
		).toBe(true);
	});

	it('finds the latest non-empty user text', () => {
		expect(
			lastSuperAgentUserText([
				{ role: 'user', parts: [{ type: 'text', text: 'First prompt' }] },
				{
					role: 'assistant',
					parts: [{ type: 'tool-give_practice_question', state: 'output-available' }]
				}
			])
		).toBe('First prompt');
	});
});
