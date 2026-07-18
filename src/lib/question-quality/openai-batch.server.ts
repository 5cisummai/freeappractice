import { env } from '$env/dynamic/private';
import {
	assessmentJsonSchema,
	buildQuestionQualityPrompt,
	buildQuestionQualityWebSearchTool,
	requiresWebSearchForQuestion
} from './rubric.server.js';

function getApiKey(): string {
	const key = env.OPEN_AI_KEY?.trim();
	if (!key) throw new Error('OPEN_AI_KEY is required for question quality review');
	return key;
}

function apiUrl(path: string): string {
	return `${(env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}${path}`;
}

function webSearchContextSize(): 'low' | 'medium' | 'high' {
	const configured = env.QUESTION_QUALITY_WEB_SEARCH_CONTEXT_SIZE;
	return configured === 'low' || configured === 'medium' || configured === 'high'
		? configured
		: 'high';
}

async function openAiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const response = await fetch(apiUrl(path), {
			...init,
			headers: {
				Authorization: `Bearer ${getApiKey()}`,
				...init.headers
			}
		});
		if (response.ok) return response;
		const retryable = response.status === 429 || response.status >= 500;
		if (!retryable || attempt === 3) {
			throw new Error(`OpenAI ${path} failed (${response.status}): ${await response.text()}`);
		}
		const retryAfter = Number(response.headers.get('retry-after'));
		const delayMs = Number.isFinite(retryAfter)
			? Math.min(10_000, Math.max(250, retryAfter * 1_000))
			: 500 * 2 ** attempt + Math.floor(Math.random() * 250);
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
	throw new Error(`OpenAI ${path} failed after retries`);
}

export function buildBatchLine(opts: {
	questionId: string;
	question: Record<string, unknown>;
	model: string;
	reasoningEffort: string;
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
						tools: [buildQuestionQualityWebSearchTool(webSearchContextSize())],
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
			max_output_tokens: Number.parseInt(env.QUESTION_QUALITY_MAX_OUTPUT_TOKENS || '800', 10)
		}
	});
}

export async function uploadBatchInput(contents: string, filename: string): Promise<string> {
	const form = new FormData();
	form.set('purpose', 'batch');
	form.set('file', new Blob([contents], { type: 'application/jsonl' }), filename);
	const response = await openAiFetch('/files', { method: 'POST', body: form });
	const payload = (await response.json()) as { id: string };
	return payload.id;
}

export async function createOpenAiBatch(opts: {
	inputFileId: string;
	idempotencyKey: string;
}): Promise<{ id: string; status: string }> {
	const response = await openAiFetch('/batches', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Idempotency-Key': opts.idempotencyKey
		},
		body: JSON.stringify({
			input_file_id: opts.inputFileId,
			endpoint: '/v1/responses',
			completion_window: '24h',
			metadata: { purpose: 'question-quality-review' }
		})
	});
	return response.json() as Promise<{ id: string; status: string }>;
}

export async function retrieveOpenAiBatch(batchId: string): Promise<{
	id: string;
	status: string;
	output_file_id?: string;
	error_file_id?: string;
}> {
	const response = await openAiFetch(`/batches/${encodeURIComponent(batchId)}`);
	return response.json() as Promise<{
		id: string;
		status: string;
		output_file_id?: string;
		error_file_id?: string;
	}>;
}

export async function downloadOpenAiFile(fileId: string): Promise<string> {
	const response = await openAiFetch(`/files/${encodeURIComponent(fileId)}/content`);
	return response.text();
}

export async function cancelOpenAiBatch(batchId: string): Promise<void> {
	await openAiFetch(`/batches/${encodeURIComponent(batchId)}/cancel`, { method: 'POST' });
}
