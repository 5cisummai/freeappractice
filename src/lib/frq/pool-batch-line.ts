import { buildFrqGenerationPrompt, generatedFrqJsonSchema } from '$lib/frq/generation.server';

/** One OpenAI Batch JSONL request for FRQ pool generation (`/v1/responses`). */
export function buildFrqPoolBatchLine(opts: {
	customId: string;
	apClass: string;
	unit: string;
	recentTopics?: string[];
	model: string;
	reasoningEffort?: 'low' | 'medium' | 'high';
	maxOutputTokens?: number;
}): string {
	const prompt = buildFrqGenerationPrompt(opts.apClass, opts.unit, opts.recentTopics ?? []);

	return JSON.stringify({
		custom_id: opts.customId,
		method: 'POST',
		url: '/v1/responses',
		body: {
			model: opts.model,
			reasoning: { effort: opts.reasoningEffort ?? 'high' },
			input: [
				{ role: 'developer', content: prompt.system },
				{ role: 'user', content: prompt.user }
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'frq_question',
					strict: true,
					schema: generatedFrqJsonSchema()
				}
			},
			max_output_tokens: opts.maxOutputTokens ?? 16_000
		}
	});
}
