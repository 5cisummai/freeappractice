import { describe, expect, it } from 'vitest';
import {
	buildCoachPracticeQuestionToolOutput,
	getCoachPracticeQuestionToolInput,
	getCoachPracticeQuestionToolOutput
} from '$lib/agent/tools/practice';
import { isAgentToolContinuation, lastAgentUserText } from '$lib/agent/request';

describe('coach practice question tool helpers', () => {
	it('parses tool input', () => {
		expect(
			getCoachPracticeQuestionToolInput({
				course: 'AP Physics 1',
				unit: 'Unit 1',
				mode: 'mcq'
			})
		).toEqual({
			course: 'AP Physics 1',
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
				course: 'AP Physics 1',
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
			isAgentToolContinuation([
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
			lastAgentUserText([
				{ role: 'user', parts: [{ type: 'text', text: 'First prompt' }] },
				{
					role: 'assistant',
					parts: [{ type: 'tool-give_practice_question', state: 'output-available' }]
				}
			])
		).toBe('First prompt');
	});
});
