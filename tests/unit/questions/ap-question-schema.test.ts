import { describe, expect, it } from 'vitest';
import {
	assertOpenAiCompatibleObjectSchema,
	findOpenAiOptionalPropertyPaths
} from '$lib/ai/openai-structured-schema';
import { apQuestionSchema } from '$lib/questions/generation.server';

describe('apQuestionSchema OpenAI structured-output compatibility', () => {
	it('keeps every property required so OpenAI does not reject hint1/hint2 as optional', () => {
		expect(findOpenAiOptionalPropertyPaths(apQuestionSchema)).toEqual([]);
		expect(() =>
			assertOpenAiCompatibleObjectSchema(apQuestionSchema, { schemaName: 'ap_question' })
		).not.toThrow();
	});
});
