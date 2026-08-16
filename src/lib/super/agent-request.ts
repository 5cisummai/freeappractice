import { z } from 'zod';
import { coachComposerActionIds } from '$lib/super/coach-composer-actions';
import type { SuperAgentContext } from '$lib/super/coach-agent.types';

export const MAX_SUPER_AGENT_MESSAGES = 48;
export const MAX_SUPER_AGENT_REQUEST_BYTES = 8 * 1024 * 1024;
export const MAX_SUPER_AGENT_TEXT_CHARS = 16_000;
export const MAX_TUTOR_MEMORY_EXCHANGE_CHARS = 8_000;

const messagePartSchema = z.looseObject({
	type: z.string().min(1).max(100),
	text: z.string().max(MAX_SUPER_AGENT_TEXT_CHARS).optional()
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
	coachActions: z.array(z.enum(coachComposerActionIds)).max(4).optional(),
	context: superAgentContextSchema,
	messages: z
		.array(superAgentMessageSchema)
		.min(1)
		.max(MAX_SUPER_AGENT_MESSAGES * 2)
});

export type SuperAgentRequest = z.infer<typeof superAgentRequestSchema>;

function trimSuperAgentText(text: string): string {
	return text.slice(0, MAX_SUPER_AGENT_TEXT_CHARS);
}

export function toSuperAgentModelMessages(messages: SuperAgentRequest['messages']) {
	return messages.slice(-MAX_SUPER_AGENT_MESSAGES).flatMap((message) => {
		const content = trimSuperAgentText(
			message.parts
				.filter((part) => part.type === 'text' && typeof part.text === 'string')
				.map((part) => part.text!.trim())
				.filter(Boolean)
				.join('\n')
		);
		return content ? [{ role: message.role, content } as const] : [];
	});
}

function isToolPart(part: { type?: string; state?: string }): boolean {
	return typeof part.type === 'string' && part.type.startsWith('tool-');
}

export function lastSuperAgentUserText(messages: SuperAgentRequest['messages']): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== 'user') continue;
		const text = trimSuperAgentText(
			message.parts
				.filter((part) => part.type === 'text' && typeof part.text === 'string')
				.map((part) => part.text!.trim())
				.filter(Boolean)
				.join('\n')
		);
		if (text) return text;
	}
	return '';
}

export function isSuperAgentToolContinuation(messages: SuperAgentRequest['messages']): boolean {
	const lastMessage = messages.at(-1);
	if (!lastMessage || lastMessage.role !== 'assistant') return false;
	return lastMessage.parts.some(
		(part) =>
			isToolPart(part) &&
			(part.state === 'output-available' || part.state === 'output-error')
	);
}

/** Send only the latest user turn or tool continuation; server loads the rest from storage. */
export function minimalSuperAgentClientMessages(
	messages: SuperAgentRequest['messages']
): SuperAgentRequest['messages'] {
	if (messages.length === 0) return [];
	if (isSuperAgentToolContinuation(messages)) {
		const last = messages.at(-1);
		return last ? [last] : [];
	}
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index].role === 'user') return [messages[index]];
	}
	const last = messages.at(-1);
	return last ? [last] : [];
}

export function toSuperAgentContext(input: SuperAgentRequest['context']): SuperAgentContext {
	return input;
}

export function textFromSuperAgentParts(
	parts: Array<{ type?: string; text?: string }> | undefined
): string {
	return trimSuperAgentText(
		(parts ?? [])
			.filter((part) => part.type === 'text' && typeof part.text === 'string')
			.map((part) => part.text!.trim())
			.filter(Boolean)
			.join('\n')
	);
}
