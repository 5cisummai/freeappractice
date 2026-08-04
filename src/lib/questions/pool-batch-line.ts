import { apQuestionJsonSchema, buildMcqGenerationPrompt } from './generation.server.js';

/** One OpenAI Batch JSONL request for MCQ pool generation (`/v1/responses`). */
export function buildMcqPoolBatchLine(opts: {
	customId: string;
	className: string;
	unit: string;
	recentTopics?: string[];
	model: string;
	reasoningEffort?: 'low' | 'medium' | 'high';
	maxOutputTokens?: number;
}): string {
	const { system, user } = buildMcqGenerationPrompt({
		className: opts.className,
		unit: opts.unit,
		recentTopics: opts.recentTopics
	});

	return JSON.stringify({
		custom_id: opts.customId,
		method: 'POST',
		url: '/v1/responses',
		body: {
			model: opts.model,
			reasoning: { effort: opts.reasoningEffort ?? 'medium' },
			input: [
				{ role: 'developer', content: system },
				{ role: 'user', content: user }
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'ap_question',
					strict: true,
					schema: apQuestionJsonSchema()
				}
			},
			max_output_tokens: opts.maxOutputTokens ?? 6_000
		}
	});
}
