import {
	assessmentJsonSchema,
	buildQuestionQualityPrompt,
	buildQuestionQualityWebSearchTool,
	requiresWebSearchForQuestion
} from './rubric.server.js';

export function buildBatchLine(opts: {
	questionId: string;
	question: Record<string, unknown>;
	model: string;
	reasoningEffort: string;
	maxOutputTokens: number;
	webSearchContextSize: 'low' | 'medium' | 'high';
}): string {
	const prompt = buildQuestionQualityPrompt(opts.question);
	const webSearchEnabled = requiresWebSearchForQuestion(opts.question);
	return JSON.stringify({
		custom_id: opts.questionId,
		method: 'POST',
		url: '/v1/responses',
		body: {
			model: opts.model,
			reasoning: { effort: opts.reasoningEffort },
			...(webSearchEnabled
				? {
						tools: [buildQuestionQualityWebSearchTool(opts.webSearchContextSize)],
						tool_choice: 'required',
						include: ['web_search_call.action.sources']
					}
				: {}),
			input: [
				{ role: 'developer', content: prompt.developer },
				{ role: 'user', content: prompt.user }
			],
			text: {
				format: {
					type: 'json_schema',
					name: 'question_quality_assessment',
					strict: true,
					schema: assessmentJsonSchema
				}
			},
			max_output_tokens: opts.maxOutputTokens
		}
	});
}
