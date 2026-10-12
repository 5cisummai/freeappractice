import { tool } from 'ai';

import Parallel from 'parallel-web';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { COACH_MODEL } from '$lib/agent/model';

import type { AgentToolsInput } from '$lib/agent/request';

const webSearchSchema = z.object({
	objective: z
		.string()
		.trim()
		.min(1)
		.max(1000)
		.describe('Specific public fact to verify; exclude private student information.'),
	search_queries: z
		.array(z.string().trim().min(1).max(200))
		.min(1)
		.max(3)
		.describe('One to three distinct focused keyword queries; prefer official source names.')
});

let parallelClient: Parallel | undefined;

function getParallelClient(): Parallel {
	const apiKey = env.PARALLEL_API_KEY?.trim();
	if (!apiKey) throw new Error('PARALLEL_API_KEY is not configured');
	parallelClient ??= new Parallel({ apiKey, timeout: 15_000, maxRetries: 0 });
	return parallelClient;
}

export function createSearchTools(input: AgentToolsInput) {
	const { canAffordWebSearch, recordWebSearch } = input;
	return {
		...(env.PARALLEL_API_KEY?.trim()
			? {
					search_web: tool({
						description:
							'Search public web sources when the user needs current or externally verifiable facts. Prefer official sources and cite results using [cite:sourceId] with their returned sourceId. Use normal Markdown links when directing the user to a page. Do not search for information already returned in this turn. Never include student names, grades, or private account details.',
						inputSchema: webSearchSchema,
						execute: async ({ objective, search_queries }, { abortSignal, toolCallId }) => {
							try {
								if (!(await canAffordWebSearch())) {
									return {
										error: 'Web search requires at least 0.25 Coach credits remaining this month.'
									};
								}
								const response = await getParallelClient().search(
									{
										objective,
										search_queries,
										mode: 'fast',
										client_model: COACH_MODEL,
										max_chars_total: 6_000,
										advanced_settings: {
											max_results: 5,
											excerpt_settings: { max_chars_per_result: 1200 }
										}
									},
									{ signal: abortSignal }
								);
								recordWebSearch();
								return {
									results: response.results.map((result, index) => ({
										sourceId: `${toolCallId}-${index + 1}`,
										title: result.title ?? result.url,
										url: result.url,
										publishDate: result.publish_date ?? null,
										excerpts: result.excerpts
									})),
									warnings: response.warnings?.map((warning) => warning.message) ?? []
								};
							} catch {
								return { error: 'Parallel web search is temporarily unavailable.' };
							}
						}
					})
				}
			: {})
	};
}
