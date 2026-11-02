import { describe, expect, it } from 'vitest';
import { getCourseNames, getUnitsForCourse } from '#lib/catalog/courses.js';
import {
	buildCoachPracticeQuestionToolOutput,
	coachPracticeQuestionRequestKey,
	getCoachPracticeQuestionAssignment,
	getCoachPracticeQuestionToolInput,
	getCoachPracticeQuestionToolOutput,
	isCoachPracticeQuestionPending
} from '#lib/agent/tools/practice.js';
import { isAgentToolContinuation, lastAgentUserText } from '#lib/agent/request.js';

describe('coach practice question tool helpers', () => {
	it('parses tool input', () => {
		expect(
			getCoachPracticeQuestionToolInput({
				course: 'AP Physics 1',
				unit: 'Unit 1: Kinematics',
				mode: 'mcq'
			})
		).toEqual({
			course: 'AP Physics 1',
			unit: 'Unit 1: Kinematics',
			mode: 'mcq'
		});
	});

	it('treats only complete tool input as mountable', () => {
		expect(
			isCoachPracticeQuestionPending({
				type: 'tool-give_practice_question',
				state: 'input-available'
			})
		).toBe(true);
		expect(
			isCoachPracticeQuestionPending({
				type: 'tool-give_practice_question',
				state: 'input-streaming'
			})
		).toBe(false);
		expect(
			isCoachPracticeQuestionPending({
				type: 'tool-give_practice_question',
				state: 'output-available'
			})
		).toBe(false);
	});

	it('keeps the fetch key stable across object identity changes', () => {
		const first = getCoachPracticeQuestionToolInput({
			course: 'AP Human Geography',
			unit: 'Unit 2: Population and Migration Patterns and Processes',
			mode: 'mcq'
		});
		const second = getCoachPracticeQuestionToolInput({
			course: 'AP Human Geography',
			unit: 'Unit 2: Population and Migration Patterns and Processes',
			mode: 'mcq'
		});

		expect(first).not.toBe(second);
		expect(coachPracticeQuestionRequestKey(first)).toBe(coachPracticeQuestionRequestKey(second));
		expect(coachPracticeQuestionRequestKey(first, 'call-1')).not.toBe(
			coachPracticeQuestionRequestKey(first, 'call-2')
		);
		expect(coachPracticeQuestionRequestKey(first)).not.toBe(
			coachPracticeQuestionRequestKey({
				...first!,
				unit: 'Unit 3: Cultural Patterns and Processes'
			})
		);
	});

	it('reads a stored assignment from a pending tool part', () => {
		const assigned = {
			kind: 'practice_question',
			mode: 'mcq',
			questionId: 'mcq-1',
			course: 'AP Physics 1',
			unit: 'Unit 1',
			practiceHref: '/app/practice',
			prompt: 'Prompt'
		};
		expect(
			getCoachPracticeQuestionAssignment({
				type: 'tool-give_practice_question',
				state: 'input-available',
				assignedQuestion: assigned
			})
		).toEqual(assigned);
	});

	it('can uniquely map catalog unit titles after stripping a Unit N prefix', () => {
		const prefix = /^(?:Unit|Big Idea) \d+:\s+/;
		for (const course of getCourseNames()) {
			const titles = new Map<string, string>();
			for (const unit of getUnitsForCourse(course)) {
				const title = unit.replace(prefix, '');
				expect(titles.has(title)).toBe(false);
				titles.set(title, unit);
			}
		}
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
