import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, Output, NoObjectGeneratedError } from 'ai';
import type { z } from 'zod';
import { OPEN_AI_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';

const OPENAI_BASE_URL = env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
export const ADVANCED_MODEL = env.ADVANCED_MODEL ?? 'gpt-5.4-mini';
const BASIC_MODEL = env.BASIC_MODEL ?? 'gpt-5.4-mini';
export const TUTOR_MODEL = env.TUTOR_MODEL ?? 'gpt-4.1-mini';

export const LATEX_RULE =
	'For ALL math and science notation use LaTeX with these exact delimiters ONLY: $...$ for inline math, $$...$$ for display (block) math. Do NOT use \\(...\\), \\[...\\], \\begin{equation}, \\begin{align}, or any other LaTeX environment delimiters — they will not render.';

function getProvider() {
	if (!OPEN_AI_KEY) throw new Error('OPEN_AI_KEY is not set');
	return createOpenAI({
		apiKey: OPEN_AI_KEY,
		baseURL: OPENAI_BASE_URL
	});
}

function model(id: string) {
	return getProvider()(id);
}

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

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

type ConversationMessage = {
	role: 'user' | 'assistant';
	content: string;
};

/** Pull trusted server-side system prompts out of messages for the AI SDK `system` option. */
function splitSystemMessages(messages: ChatMessage[]): {
	system?: string;
	messages: ConversationMessage[];
} {
	const systemParts: string[] = [];
	const conversationMessages: ConversationMessage[] = [];

	for (const message of messages) {
		if (message.role === 'system') {
			systemParts.push(message.content);
		} else if (message.role === 'user' || message.role === 'assistant') {
			conversationMessages.push({ role: message.role, content: message.content });
		}
	}

	return {
		...(systemParts.length > 0 && { system: systemParts.join('\n\n') }),
		messages: conversationMessages
	};
}

export type ChatCompletionParams = {
	model: string;
	messages: ChatMessage[];
	maxOutputTokens?: number;
};

export type StructuredCompletionParams<T> = {
	model: string;
	messages: ChatMessage[];
	schema: z.ZodType<T>;
	schemaName?: string;
	reasoningEffort?: 'low' | 'medium' | 'high';
};

export async function runStructuredCompletion<T>(
	callName: string,
	opts: StructuredCompletionParams<T>,
	logContext: Record<string, unknown>
): Promise<{ parsed: T; model: string }> {
	const doneAiCall = logger.aiCall(callName, opts.model, logContext);
	const { system, messages } = splitSystemMessages(opts.messages);
	try {
		const result = await generateText({
			model: model(opts.model),
			...(system != null && { system }),
			messages,
			output: Output.object({
				name: opts.schemaName,
				schema: opts.schema
			}),
			providerOptions: {
				openai: {
					forceReasoning: true,
					...(opts.reasoningEffort != null && { reasoningEffort: opts.reasoningEffort })
				}
			}
		});

		const parsed = result.output;
		if (!parsed) throw new Error('No parsed output from structured response');

		doneAiCall({
			promptTokens: result.usage.inputTokens,
			completionTokens: result.usage.outputTokens
		});
		return { parsed, model: opts.model };
	} catch (err) {
		if (NoObjectGeneratedError.isInstance(err)) {
			logger.error(`[ai] ${callName} failed — no object generated`, {
				...logContext,
				model: opts.model,
				text: err.text,
				cause: err.cause
			});
			throw new Error('No parsed output from structured response', { cause: err });
		}
		logger.error(`[ai] ${callName} failed`, { ...logContext, model: opts.model, error: err });
		throw err;
	}
}

export async function runChatCompletion(
	callName: string,
	params: ChatCompletionParams,
	logContext: Record<string, unknown> = {}
): Promise<{ content: string; model: string }> {
	const doneAiCall = logger.aiCall(callName, params.model, logContext);
	const { system, messages } = splitSystemMessages(params.messages);
	try {
		const result = await generateText({
			model: model(params.model),
			...(system != null && { system }),
			messages,
			maxOutputTokens: params.maxOutputTokens
		});
		doneAiCall({ completionTokens: result.usage.outputTokens });
		return {
			content: result.text,
			model: params.model
		};
	} catch (err) {
		logger.error(`[ai] ${callName} failed`, { ...logContext, model: params.model, error: err });
		throw err;
	}
}

export async function* runStreamingChat(
	callName: string,
	params: ChatCompletionParams,
	logContext: Record<string, unknown> = {}
): AsyncGenerator<string> {
	const doneAiCall = logger.aiCall(callName, params.model, logContext);
	const { system, messages } = splitSystemMessages(params.messages);
	try {
		const result = streamText({
			model: model(params.model),
			...(system != null && { system }),
			messages,
			maxOutputTokens: params.maxOutputTokens
		});

		let chunks = 0;
		for await (const chunk of result.textStream) {
			chunks++;
			yield chunk;
		}
		doneAiCall({ chunks });
	} catch (err) {
		logger.error(`[ai] ${callName} failed`, { ...logContext, model: params.model, error: err });
		throw err;
	}
}
