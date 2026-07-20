import { describe, expect, it } from 'vitest';
import { buildMcqPoolBatchLine } from '$lib/questions/pool-batch-line';
import { apQuestionJsonSchema } from '$lib/questions/generation.server';

describe('buildMcqPoolBatchLine', () => {
	it('emits OpenAI Batch /v1/responses JSONL with strict ap_question schema', () => {
		const line = buildMcqPoolBatchLine({
			customId: 'mcq-0001',
			className: 'AP Biology',
			unit: 'Unit 1',
			recentTopics: ['photosynthesis overview'],
			model: 'gpt-5.4-mini',
			reasoningEffort: 'medium'
		});
		const parsed = JSON.parse(line) as {
			custom_id: string;
			method: string;
			url: string;
			body: {
				model: string;
				reasoning: { effort: string };
				input: Array<{ role: string; content: string }>;
				text: { format: { type: string; name: string; strict: boolean; schema: unknown } };
				max_output_tokens: number;
			};
		};

		expect(parsed.custom_id).toBe('mcq-0001');
		expect(parsed.method).toBe('POST');
		expect(parsed.url).toBe('/v1/responses');
		expect(parsed.body.model).toBe('gpt-5.4-mini');
		expect(parsed.body.reasoning.effort).toBe('medium');
		expect(parsed.body.input).toHaveLength(2);
		expect(parsed.body.input[0]?.role).toBe('developer');
		expect(parsed.body.input[1]?.role).toBe('user');
		expect(parsed.body.input[0]?.content.length).toBeGreaterThan(50);
		expect(parsed.body.text.format.type).toBe('json_schema');
		expect(parsed.body.text.format.name).toBe('ap_question');
		expect(parsed.body.text.format.strict).toBe(true);
		expect(parsed.body.max_output_tokens).toBe(6_000);
	});

	it('exports a JSON schema with additionalProperties false', () => {
		const schema = apQuestionJsonSchema();
		expect(schema.type).toBe('object');
		expect(schema.additionalProperties).toBe(false);
		expect(schema.$schema).toBeUndefined();
		expect(Array.isArray(schema.required)).toBe(true);
	});
});
