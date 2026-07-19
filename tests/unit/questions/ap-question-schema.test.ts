import { describe, expect, it } from 'vitest';
import {
	assertOpenAiCompatibleObjectSchema,
	findOpenAiOptionalPropertyPaths
} from '$lib/ai/openai-structured-schema';
import { apQuestionSchema } from '$lib/questions/generation.server';

describe('apQuestionSchema OpenAI structured-output compatibility', () => {
	it('includes every property in JSON Schema required (OpenAI rejects .optional())', () => {
		expect(findOpenAiOptionalPropertyPaths(apQuestionSchema)).toEqual([]);
		expect(() =>
			assertOpenAiCompatibleObjectSchema(apQuestionSchema, { schemaName: 'ap_question' })
		).not.toThrow();
	});

	it('requires hint1 and hint2 so multi-attempt live generation cannot 500 on schema', () => {
		const missing = findOpenAiOptionalPropertyPaths(apQuestionSchema);
		expect(missing).not.toEqual(expect.arrayContaining(['hint1', 'hint2']));
		expect(() =>
			assertOpenAiCompatibleObjectSchema(apQuestionSchema, { schemaName: 'ap_question' })
		).not.toThrow();
	});
});
