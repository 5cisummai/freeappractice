import { describe, expect, it } from 'vitest';
import {
	assertOpenAiCompatibleObjectSchema,
	findOpenAiOptionalPropertyPaths
} from '$lib/ai/openai-structured-schema';
import {
	apQuestionSchema,
	parseGeneratedApQuestion
} from '$lib/question-bank/mcq/generation.server';

describe('apQuestionSchema OpenAI structured-output compatibility', () => {
	it('keeps every property required for OpenAI structured outputs', () => {
		expect(findOpenAiOptionalPropertyPaths(apQuestionSchema)).toEqual([]);
		expect(() =>
			assertOpenAiCompatibleObjectSchema(apQuestionSchema, { schemaName: 'ap_question' })
		).not.toThrow();
	});

	it('decodes the JSON-string DiagramSpec representation', () => {
		const parsed = parseGeneratedApQuestion({
			question: 'Which angle is shown?',
			optionA: '30°',
			optionB: '45°',
			optionC: '60°',
			optionD: '90°',
			correctAnswer: 'C',
			explanation: 'The diagram shows 60°.',
			mainTopic: 'Angle measurement',
			topicsCovered: 'Angles',
			diagram: JSON.stringify({
				type: 'unit-circle',
				accessibleDescription: 'A unit circle with a 60 degree angle.',
				angleDegrees: 60
			})
		});

		expect(parsed.diagram).toMatchObject({ type: 'unit-circle', angleDegrees: 60 });
	});
});
