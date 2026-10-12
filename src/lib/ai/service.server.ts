import {
	NoObjectGeneratedError,
	NoOutputGeneratedError,
	Output,
	isStepCount,
	ToolLoopAgent,
	type ToolSet
} from 'ai';
import type { z } from 'zod';
import { gatewayModel } from '$lib/ai/gateway.server';
import { logger } from '$lib/server/logger';

const STRUCTURED_OUTPUT_STEP_LIMIT = 10;
const STRUCTURED_OUTPUT_FINAL_STEP = STRUCTURED_OUTPUT_STEP_LIMIT - 1;

type StructuredObjectParams<T> = {
	callName: string;
	model: string;
	system: string;
	user: string;
	schema: z.ZodType<T>;
	schemaName: string;
	reasoningEffort?: 'low' | 'medium' | 'high';
	logContext?: Record<string, unknown>;
	tools?: ToolSet;
};

/** Structured object generation with shared logging and failure shaping. */
export async function structuredObject<T>(
	opts: StructuredObjectParams<T>
): Promise<{ parsed: T; model: string }> {
	const { callName, model, system, user, schema, schemaName, reasoningEffort, logContext, tools } =
		opts;
	const doneAiCall = logger.aiCall(callName, model, logContext);
	let stepsCompleted = 0;
	try {
		const agent = new ToolLoopAgent({
			model: gatewayModel(model),
			instructions: system,
			...(tools ? { tools } : {}),
			stopWhen: isStepCount(STRUCTURED_OUTPUT_STEP_LIMIT),
			prepareStep: ({ stepNumber }) =>
				stepNumber >= STRUCTURED_OUTPUT_FINAL_STEP
					? { activeTools: [], toolChoice: 'none' as const }
					: undefined,
			output: Output.object({ name: schemaName, schema }),
			providerOptions: {
				openai: {
					forceReasoning: true,
					...(reasoningEffort != null && { reasoningEffort })
				}
			},
			onStepEnd: ({ finishReason, rawFinishReason, toolCalls, usage }) => {
				stepsCompleted += 1;
				logger.info(`[ai] ${callName} step ${stepsCompleted} finished`, {
					...logContext,
					model,
					finishReason,
					rawFinishReason,
					toolNames: toolCalls.map((call) => call.toolName),
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens
				});
			}
		});
		const result = await agent.generate({ prompt: user });
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
				error: 'No structured object generated'
			});
			throw new Error('No parsed output from structured response', { cause: err });
		}
		if (NoOutputGeneratedError.isInstance(err)) {
			logger.error(`[ai] ${callName} failed — no final output generated`, {
				...logContext,
				model,
				stepsCompleted,
				error: err
			});
			throw new Error('No final output from structured response', { cause: err });
		}
		logger.error(`[ai] ${callName} failed`, { ...logContext, model, error: err });
		throw err;
	}
}
