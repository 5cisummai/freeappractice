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
			diagram: z.string().optional(),
			note: z.string().optional()
		});

		expect(findOpenAiOptionalPropertyPaths(schema)).toEqual(
			expect.arrayContaining(['diagram', 'note'])
		);
		expect(() => assertOpenAiCompatibleObjectSchema(schema, { schemaName: 'ap_question' })).toThrow(
			/Missing 'diagram'|diagram|required/i
		);
	});

	it('accepts required and nullable fields', () => {
		const schema = z.object({
			question: z.string(),
			diagram: z.string(),
			note: z.string().nullable()
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
