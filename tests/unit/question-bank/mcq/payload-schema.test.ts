import { describe, expect, it } from 'vitest';
import { parseMcqQuestionPayload } from '$lib/question-bank/mcq/payload-schema';

describe('parseMcqQuestionPayload', () => {
	it('fills optional fields omitted by legacy JSONB rows', () => {
		const parsed = parseMcqQuestionPayload({
			apClass: 'AP Biology',
			question: 'Which organelle makes ATP?',
			correctAnswer: 'b',
			optionA: 'Nucleus',
			optionB: 'Mitochondrion',
			optionC: 'Ribosome',
			optionD: 'Golgi'
		});

		expect(parsed).toMatchObject({
			apClass: 'AP Biology',
			unit: 'all-units',
			mainTopic: 'Legacy topic',
			topicsCovered: '',
			diagramSpec: null,
			hasDiagram: false,
			correctAnswer: 'B',
			explanation: ''
		});
	});

	it('derives hasDiagram from a legacy diagram object', () => {
		const parsed = parseMcqQuestionPayload({
			apClass: 'AP Physics 1',
			unit: 'Kinematics',
			question: 'Which graph is correct?',
			correctAnswer: 'A',
			diagram: { type: 'line' }
		});

		expect(parsed.diagramSpec).toEqual({ type: 'line' });
		expect(parsed.hasDiagram).toBe(true);
	});
});
