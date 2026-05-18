import OpenAI from 'openai';
import { OPEN_AI_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';

/**
 * AI abstraction layer: centralises OpenAI client creation, model configuration,
 * and the three completion primitives (structured, chat, streaming) used across
 * the backend.  All model names and base-URL are env-configurable with sensible
 * defaults — nothing is hard-coded outside this file.
 */

// ── Configuration ──────────────────────────────────────────────
export const OPENAI_BASE_URL = env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
export const ADVANCED_MODEL = env.ADVANCED_MODEL ?? 'gpt-5.4-mini';
export const BASIC_MODEL = env.BASIC_MODEL ?? 'gpt-5.4-mini';
export const TUTOR_MODEL = env.TUTOR_MODEL ?? 'gpt-4.1-mini';
export const GRADING_MODEL = env.GRADING_MODEL ?? 'gpt-5.4-mini';

export const LATEX_RULE =
	'For ALL math and science notation use LaTeX with these exact delimiters ONLY: $...$ for inline math, $$...$$ for display (block) math. Do NOT use \\(...\\), \\[...\\], \\begin{equation}, \\begin{align}, or any other LaTeX environment delimiters — they will not render.';

// ── Shared client ──────────────────────────────────────────────
export function buildClient(): OpenAI {
	if (!OPEN_AI_KEY) throw new Error('OPEN_AI_KEY is not set');
	return new OpenAI({ baseURL: OPENAI_BASE_URL, apiKey: OPEN_AI_KEY });
}

// ── Model selection ────────────────────────────────────────────
/**
 * Humanities/social courses use `BASIC_MODEL`; STEM-style workloads use `ADVANCED_MODEL`.
 */
export function selectModelForClass(className: string): string {
	const normalized = (className ?? '').toLowerCase();
	const basicKeywords = [
		'history',
		'government',
		'economics',
		'psychology',
		'sociology',
		'human geography',
		'world studies',
		'english',
		'literature',
		'computer science principles'
	];
	if (basicKeywords.some((kw) => normalized.includes(kw))) return BASIC_MODEL;
	return ADVANCED_MODEL;
}

// ── Completion primitives ──────────────────────────────────────

/**
 * Structured-output completion via `chat.completions.parse`.
 * Callers pass the Zod-backed `response_format` on `params`; `T` is the parsed payload.
 */
export async function runStructuredCompletion<T>(
	callName: string,
	params: Parameters<OpenAI['chat']['completions']['parse']>[0],
	logContext: Record<string, unknown>
): Promise<{ parsed: T; model: string }> {
	const client = buildClient();
	const doneAiCall = logger.aiCall(callName, params.model, logContext);
	let completion;
	try {
		completion = await client.chat.completions.parse(params);
	} catch (err) {
		logger.error(`[ai] ${callName} failed`, { ...logContext, model: params.model, error: err });
		throw err;
	}
	const msg = completion?.choices?.[0]?.message;
	if (!msg) throw new Error('No message returned from provider');
	if (msg.refusal) throw new Error('Content refused by provider');
	const parsed = msg.parsed as T;
	if (!parsed) throw new Error('No parsed output from structured response');
	doneAiCall({
		promptTokens: completion.usage?.prompt_tokens,
		completionTokens: completion.usage?.completion_tokens
	});
	return { parsed, model: params.model };
}

/**
 * Non-streaming chat completion. Returns the assistant message content.
 */
export async function runChatCompletion(
	callName: string,
	params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, 'stream'>,
	logContext: Record<string, unknown> = {}
): Promise<{ content: string; model: string }> {
	const client = buildClient();
	const doneAiCall = logger.aiCall(callName, params.model, logContext);
	let response;
	try {
		response = await client.chat.completions.create({ ...params, stream: false });
	} catch (err) {
		logger.error(`[ai] ${callName} failed`, { ...logContext, model: params.model, error: err });
		throw err;
	}
	doneAiCall({ completionTokens: response.usage?.completion_tokens });
	return {
		content: response.choices[0]?.message?.content ?? '',
		model: params.model
	};
}

/**
 * Streaming chat completion. Yields content delta strings.
 */
export async function* runStreamingChat(
	callName: string,
	params: Omit<OpenAI.Chat.ChatCompletionCreateParamsStreaming, 'stream'>,
	logContext: Record<string, unknown> = {}
): AsyncGenerator<string> {
	const client = buildClient();
	const doneAiCall = logger.aiCall(callName, params.model, logContext);
	let stream;
	try {
		stream = await client.chat.completions.create({ ...params, stream: true });
	} catch (err) {
		logger.error(`[ai] ${callName} failed`, { ...logContext, model: params.model, error: err });
		throw err;
	}

	let chunks = 0;
	for await (const chunk of stream) {
		const content = chunk.choices[0]?.delta?.content;
		if (content) {
			chunks++;
			yield content;
		}
	}
	doneAiCall({ chunks });
}
