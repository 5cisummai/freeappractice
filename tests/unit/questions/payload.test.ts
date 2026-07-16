import { describe, expect, it } from 'vitest';
import { parseQuestionPayloadFromResponse } from '$lib/questions/payload';

const validOptions = [
	{ id: 'A', text: 'Three' },
	{ id: 'B', text: 'Four' },
	{ id: 'C', text: 'Five' },
	{ id: 'D', text: 'Six' }
];

function validPayload(overrides: Record<string, unknown> = {}) {
	return {
		question: 'What is 2+2?',
		options: validOptions,
		correctAnswer: 'B',
		explanation: 'Basic arithmetic.',
		...overrides
	};
}

describe('parseQuestionPayloadFromResponse', () => {
	it('parses a direct object payload with A–D options', () => {
		const result = parseQuestionPayloadFromResponse({
			questionId: 'q-1',
			...validPayload()
		});

		expect(result.questionId).toBe('q-1');
		expect(result.prompt).toBe('What is 2+2?');
		expect(result.correctAnswer).toBe('B');
		expect(result.options).toHaveLength(4);
		expect(result.hasStimulus).toBe(false);
	});

	it('parses JSON string answers and strips markdown fences', () => {
		const result = parseQuestionPayloadFromResponse({
			questionId: 'q-2',
			answer: '```json\n' + JSON.stringify(validPayload({ questionId: 'inner-id' })) + '\n```'
		});

		expect(result.questionId).toBe('inner-id');
		expect(result.correctAnswer).toBe('B');
	});

	it('builds stimulus panels and preserves fenced code in paragraphs', () => {
		const stimulus = 'Intro\n\n```js\nconst x = 1;\n```\n\nOutro';
		const result = parseQuestionPayloadFromResponse(
			validPayload({
				stimulus,
				question: 'Prompt line one\n\nPrompt line two'
			})
		);

		expect(result.hasStimulus).toBe(true);
		expect(result.leftPanel?.title).toBe('Stimulus');
		expect(result.leftPanel?.content.some((p) => p.includes('```js'))).toBe(true);
		expect(result.rightPanel?.content).toEqual(['Prompt line one', 'Prompt line two']);
	});

	it('accepts optionA–optionD object shape', () => {
		const result = parseQuestionPayloadFromResponse({
			question: 'Pick one',
			optionA: 'A text',
			optionB: 'B text',
			optionC: 'C text',
			optionD: 'D text',
			correctAnswer: 'answer is C'
		});

		expect(result.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
		expect(result.correctAnswer).toBe('C');
	});

	it('throws when the response includes an error string', () => {
		expect(() => parseQuestionPayloadFromResponse({ error: 'Pool empty' })).toThrow('Pool empty');
	});

	it('throws when answer JSON is invalid', () => {
		expect(() => parseQuestionPayloadFromResponse({ answer: '{not-json' })).toThrow(
			'Question service returned an invalid question payload.'
		);
	});

	it('throws when required fields are missing', () => {
		expect(() => parseQuestionPayloadFromResponse({ question: 'Only a prompt' })).toThrow(
			'Question API response was missing required fields.'
		);
	});

	it('allows missing correct answer letter when options are present', () => {
		const result = parseQuestionPayloadFromResponse(validPayload({ correctAnswer: undefined }));
		expect(result.correctAnswer).toBeUndefined();
	});
});
