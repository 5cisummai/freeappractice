import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import type { z } from 'zod';
import { OPEN_AI_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';

const OPENAI_BASE_URL = env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
export const GENERATION_MODEL = env.GENERATION_MODEL ?? 'gpt-5.4-mini';
export const TUTOR_MODEL = env.TUTOR_MODEL ?? 'gpt-4.1-mini';

let provider: ReturnType<typeof createOpenAI> | null = null;

/** OpenAI-compatible language model for the AI SDK. */
export function openaiModel(id: string) {
	if (!OPEN_AI_KEY) throw new Error('OPEN_AI_KEY is not set');
	provider ??= createOpenAI({
		apiKey: OPEN_AI_KEY,
		baseURL: OPENAI_BASE_URL
	});
	return provider(id);
}

type StructuredObjectParams<T> = {
	callName: string;
	model: string;
	system: string;
	user: string;
	schema: z.ZodType<T>;
	schemaName: string;
	reasoningEffort?: 'low' | 'medium' | 'high';
	logContext?: Record<string, unknown>;
};

/** Structured object generation with shared logging and failure shaping. */
export async function structuredObject<T>(
	opts: StructuredObjectParams<T>
): Promise<{ parsed: T; model: string }> {
	const { callName, model, system, user, schema, schemaName, reasoningEffort, logContext } = opts;
	const doneAiCall = logger.aiCall(callName, model, logContext);
	try {
		const result = await generateText({
			model: openaiModel(model),
			system,
			messages: [{ role: 'user', content: user }],
			output: Output.object({ name: schemaName, schema }),
			providerOptions: {
				openai: {
					forceReasoning: true,
					...(reasoningEffort != null && { reasoningEffort })
				}
			}
		});
		if (!result.output) throw new Error('No parsed output from structured response');
		doneAiCall({
			promptTokens: result.usage.inputTokens,
			completionTokens: result.usage.outputTokens
		});
		return { parsed: result.output, model };
	} catch (err) {
		if (NoObjectGeneratedError.isInstance(err)) {
			logger.error(`[ai] ${callName} failed — no object generated`, {
				...logContext,
				model,
				text: err.text,
				cause: err.cause
			});
			throw new Error('No parsed output from structured response', { cause: err });
		}
		logger.error(`[ai] ${callName} failed`, { ...logContext, model, error: err });
		throw err;
	}
}
