import { z } from 'zod';
import type { SuperAgentContext } from '$lib/super/coach.server';

export const MAX_SUPER_AGENT_MESSAGES = 12;
export const MAX_SUPER_AGENT_REQUEST_BYTES = 2 * 1024 * 1024;

const messagePartSchema = z.looseObject({
	type: z.string().min(1).max(100),
	text: z.string().max(2_000).optional()
});

export const superAgentMessageSchema = z.looseObject({
	id: z.string().max(200).optional(),
	role: z.enum(['user', 'assistant']),
	parts: z.array(messagePartSchema).max(24)
});

export const superAgentContextSchema = z.strictObject({
	mode: z.enum(['coach', 'question']),
	page: z.enum(['coach', 'practice', 'progress', 'history', 'insights']).optional(),
	questionId: z.uuid().optional(),
	questionType: z.enum(['mcq', 'frq']).optional(),
	frqAttemptId: z.string().trim().max(100).optional(),
	quizId: z.uuid().optional()
});

export const superAgentRequestSchema = z.strictObject({
	sessionId: z.uuid(),
	conversationId: z.uuid().optional(),
	context: superAgentContextSchema,
	messages: z
		.array(superAgentMessageSchema)
		.min(1)
		.max(MAX_SUPER_AGENT_MESSAGES * 2)
});

export type SuperAgentRequest = z.infer<typeof superAgentRequestSchema>;

export function toSuperAgentModelMessages(messages: SuperAgentRequest['messages']) {
	return messages.slice(-MAX_SUPER_AGENT_MESSAGES).flatMap((message) => {
		const content = message.parts
			.filter((part) => part.type === 'text' && typeof part.text === 'string')
			.map((part) => part.text!.trim())
			.filter(Boolean)
			.join('\n')
			.slice(0, 2_000);
		return content ? [{ role: message.role, content } as const] : [];
	});
}

export function toSuperAgentContext(input: SuperAgentRequest['context']): SuperAgentContext {
	return input;
}

export function textFromSuperAgentParts(
	parts: Array<{ type?: string; text?: string }> | undefined
): string {
	return (parts ?? [])
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => part.text!.trim())
		.filter(Boolean)
		.join('\n')
		.slice(0, 2_000);
}
