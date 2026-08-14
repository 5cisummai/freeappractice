import { describe, expect, it } from 'vitest';
import { buildMcqPoolBatchLine } from '$lib/question-bank/mcq/batch-line';
import { apQuestionJsonSchema } from '$lib/question-bank/mcq/generation.server';
import { generatedFrqJsonSchema } from '$lib/question-bank/frq/generation.server';
import { buildFrqPoolBatchLine } from '$lib/question-bank/frq/pool-batch-line';

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
		expect(JSON.stringify(schema)).not.toContain('propertyNames');
		expect(schema.properties).toMatchObject({ diagram: { anyOf: expect.any(Array) } });
	});

	it('requires nullable optional FRQ material fields for strict OpenAI output', () => {
		const schema = generatedFrqJsonSchema() as {
			properties?: {
				materials?: {
					items?: { required?: string[]; properties?: { title?: { anyOf?: unknown[] } } };
				};
			};
		};
		const material = schema.properties?.materials?.items;

		expect(material?.required).toContain('title');
		expect(material?.properties?.title?.anyOf).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: 'null' })])
		);
	});

	it('emits a strict Luna FRQ batch request with the course profile prompt', () => {
		const parsed = JSON.parse(
			buildFrqPoolBatchLine({
				customId: 'frq-0001',
				apClass: 'AP Biology',
				unit: 'Unit 1: Chemistry of Life',
				model: 'gpt-5.6-luna'
			})
		) as {
			custom_id: string;
			url: string;
			body: {
				model: string;
				reasoning: { effort: string };
				input: Array<{ role: string; content: string }>;
				text: { format: { strict: boolean; name: string } };
				max_output_tokens: number;
			};
		};

		expect(parsed.custom_id).toBe('frq-0001');
		expect(parsed.url).toBe('/v1/responses');
		expect(parsed.body.model).toBe('gpt-5.6-luna');
		expect(parsed.body.reasoning.effort).toBe('high');
		expect(parsed.body.input[0]?.content).toContain('Course: AP Biology');
		expect(parsed.body.text.format).toMatchObject({ name: 'frq_question', strict: true });
		expect(parsed.body.max_output_tokens).toBe(16_000);
	});
});
