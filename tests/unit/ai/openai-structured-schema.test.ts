import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	assertOpenAiCompatibleObjectSchema,
	findOpenAiOptionalPropertyPaths
} from '$lib/ai/openai-structured-schema';

describe('openai structured schema compatibility', () => {
	it('flags Zod .optional() fields that OpenAI rejects', () => {
		const schema = z.object({
			question: z.string(),
			hint1: z.string().optional(),
			hint2: z.string().optional()
		});

		expect(findOpenAiOptionalPropertyPaths(schema)).toEqual(
			expect.arrayContaining(['hint1', 'hint2'])
		);
		expect(() => assertOpenAiCompatibleObjectSchema(schema, { schemaName: 'ap_question' })).toThrow(
			/Missing 'hint1'|hint1|required/i
		);
	});

	it('accepts required and nullable fields', () => {
		const schema = z.object({
			question: z.string(),
			hint1: z.string(),
			hint2: z.string().nullable()
		});

		expect(findOpenAiOptionalPropertyPaths(schema)).toEqual([]);
		expect(() => assertOpenAiCompatibleObjectSchema(schema)).not.toThrow();
	});

	it('flags nested optional properties', () => {
		const schema = z.object({
			outer: z.object({
				innerOptional: z.string().optional()
			})
		});

		expect(findOpenAiOptionalPropertyPaths(schema)).toEqual(
			expect.arrayContaining(['outer.innerOptional'])
		);
	});
});
