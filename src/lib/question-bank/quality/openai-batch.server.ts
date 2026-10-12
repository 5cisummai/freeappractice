import { env } from '$env/dynamic/private';
import { AI_GATEWAY_BASE_URL, requireGatewayCredential } from '$lib/server/gateway-credentials.server';
import { buildBatchLine as buildBatchLinePure } from './batch-line.js';

function apiUrl(path: string): string {
	const base = (env.AI_GATEWAY_BASE_URL || AI_GATEWAY_BASE_URL).replace(/\/$/, '');
	return `${base}${path}`;
}

function webSearchContextSize(): 'low' | 'medium' | 'high' {
	const configured = env.QUESTION_QUALITY_WEB_SEARCH_CONTEXT_SIZE;
	return configured === 'low' || configured === 'medium' || configured === 'high'
		? configured
		: 'high';
}

async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const apiKey = requireGatewayCredential();
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const response = await fetch(apiUrl(path), {
			...init,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				...init.headers
			}
		});
		if (response.ok) return response;
		const retryable = response.status === 429 || response.status >= 500;
		if (!retryable || attempt === 3) {
			throw new Error(`AI Gateway ${path} failed (${response.status}): ${await response.text()}`);
		}
		const retryAfter = Number(response.headers.get('retry-after'));
		const delayMs = Number.isFinite(retryAfter)
			? Math.min(10_000, Math.max(250, retryAfter * 1_000))
			: 500 * 2 ** attempt + Math.floor(Math.random() * 250);
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
	throw new Error(`AI Gateway ${path} failed after retries`);
}

export function buildBatchLine(opts: {
	questionId: string;
	question: Record<string, unknown>;
	model: string;
	reasoningEffort: string;
}): string {
	return buildBatchLinePure({
		...opts,
		maxOutputTokens: Number.parseInt(env.QUESTION_QUALITY_MAX_OUTPUT_TOKENS || '800', 10),
		webSearchContextSize: webSearchContextSize()
	});
}

export async function uploadBatchInput(
	contents: string | string[],
	filename: string
): Promise<string> {
	const form = new FormData();
	form.set('purpose', 'batch');
	const parts = typeof contents === 'string' ? [contents] : contents;
	form.set('file', new Blob(parts, { type: 'application/jsonl' }), filename);
	const response = await gatewayFetch('/files', { method: 'POST', body: form });
	const payload = (await response.json()) as { id: string };
	return payload.id;
}

export async function createOpenAiBatch(opts: {
	inputFileId: string;
	idempotencyKey: string;
	endpoint?: '/v1/responses' | '/v1/chat/completions';
	metadata?: Record<string, string>;
}): Promise<{ id: string; status: string }> {
	const response = await gatewayFetch('/batches', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Idempotency-Key': opts.idempotencyKey
		},
		body: JSON.stringify({
			input_file_id: opts.inputFileId,
			endpoint: opts.endpoint ?? '/v1/responses',
			completion_window: '24h',
			metadata: opts.metadata ?? { purpose: 'question-quality-review' }
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
	const response = await gatewayFetch(`/batches/${encodeURIComponent(batchId)}`);
	return response.json() as Promise<{
		id: string;
		status: string;
		output_file_id?: string;
		error_file_id?: string;
	}>;
}

export async function downloadOpenAiFile(fileId: string): Promise<string> {
	const response = await gatewayFetch(`/files/${encodeURIComponent(fileId)}/content`);
	return response.text();
}

export async function downloadOpenAiFileStream(
	fileId: string
): Promise<ReadableStream<Uint8Array>> {
	const response = await gatewayFetch(`/files/${encodeURIComponent(fileId)}/content`);
	if (!response.body) throw new Error('AI Gateway file response did not include a body');
	return response.body;
}

export async function cancelOpenAiBatch(batchId: string): Promise<void> {
	await gatewayFetch(`/batches/${encodeURIComponent(batchId)}/cancel`, { method: 'POST' });
}
