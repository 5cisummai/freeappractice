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

	it('parses structured stimulus metadata without changing legacy fields', () => {
		const parsed = parseMcqQuestionPayload({
			apClass: 'AP World History',
			unit: 'Unit 3',
			mainTopic: 'Trade networks',
			question: 'Which conclusion is best supported?',
			optionA: 'A',
			optionB: 'B',
			optionC: 'C',
			optionD: 'D',
			correctAnswer: 'A',
			stimulus: {
				text: 'An original practice passage.',
				diagramSpec: null,
				provenance: 'ai-generated-original'
			},
			stimulusId: '00000000-0000-4000-8000-000000000001',
			stimulusPosition: 1,
			stimulusQuestionCount: 3
		});

		expect(parsed).toMatchObject({
			question: 'Which conclusion is best supported?',
			stimulus: {
				text: 'An original practice passage.',
				provenance: 'ai-generated-original'
			},
			stimulusPosition: 1,
			stimulusQuestionCount: 3
		});
	});

	it('ignores malformed set metadata instead of breaking a legacy row', () => {
		const parsed = parseMcqQuestionPayload({
			apClass: 'AP Biology',
			question: 'Which organelle makes ATP?',
			optionA: 'A',
			optionB: 'B',
			optionC: 'C',
			optionD: 'D',
			correctAnswer: 'B',
			stimulusPosition: -1,
			stimulusQuestionCount: 0
		});
		expect(parsed.stimulusPosition).toBeNull();
		expect(parsed.stimulusQuestionCount).toBeNull();
	});
});
