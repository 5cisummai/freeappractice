import { z } from 'zod';
import { coachComposerActionIds } from '#lib/agent/personalization/composer-actions.js';

export const MAX_AGENT_MESSAGES = 96;
export const MAX_AGENT_REQUEST_BYTES = 8 * 1024 * 1024;
export const MAX_AGENT_TEXT_CHARS = 16_000;
export const MAX_TUTOR_MEMORY_EXCHANGE_CHARS = 8_000;

export const AGENT_SURFACES = ['coach'] as const;
export type AgentSurface = (typeof AGENT_SURFACES)[number];

export type AgentContext = {
	surface: AgentSurface;
	page?: 'coach' | 'practice' | 'progress' | 'history';
	questionId?: string;
	questionType?: 'mcq' | 'frq';
	frqAttemptId?: string;
	quizId?: string;
};

export const coachThinkingModeSchema = z.enum(['quick', 'thinking', 'deep']);
export type CoachThinkingMode = z.infer<typeof coachThinkingModeSchema>;

const messagePartSchema = z.looseObject({
	type: z.string().min(1).max(100),
	text: z.string().max(MAX_AGENT_TEXT_CHARS).optional()
});

export const agentMessageSchema = z.looseObject({
	id: z.string().max(200).optional(),
	role: z.enum(['user', 'assistant']),
	parts: z.array(messagePartSchema).max(24)
});

export const agentContextSchema = z.strictObject({
	surface: z.enum(AGENT_SURFACES),
	page: z.enum(['coach', 'practice', 'progress', 'history']).optional(),
	questionId: z.uuid().optional(),
	questionType: z.enum(['mcq', 'frq']).optional(),
	frqAttemptId: z.string().trim().max(100).optional(),
	quizId: z.uuid().optional()
});

export const agentRequestSchema = z.strictObject({
	sessionId: z.uuid(),
	conversationId: z.uuid().optional(),
	coachActions: z.array(z.enum(coachComposerActionIds)).max(5).optional(),
	thinkingMode: coachThinkingModeSchema.default('quick'),
	context: agentContextSchema,
	messages: z
		.array(agentMessageSchema)
		.min(1)
		.max(MAX_AGENT_MESSAGES * 2)
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;

function trimSuperAgentText(text: string): string {
	return text.slice(0, MAX_AGENT_TEXT_CHARS);
}

const coachContinuationTools = new Set([
	'tool-ask_student',
	'tool-give_practice_question',
	'tool-update_goals',
	'tool-update_study_plan'
]);

type SuperAgentClientMessage = {
	role: 'user' | 'assistant' | 'system';
	parts: unknown[];
};

export function lastAgentUserText(messages: AgentRequest['messages']): string {
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

export function isAgentToolContinuation(messages: SuperAgentClientMessage[]): boolean {
	const lastMessage = messages.at(-1);
	if (!lastMessage || lastMessage.role !== 'assistant') return false;
	const lastStep = lastMessage.parts.findLastIndex(
		(part) => (part as { type?: string } | null)?.type === 'step-start'
	);
	return lastMessage.parts.slice(lastStep + 1).some((part) => {
		if (typeof part !== 'object' || part === null) return false;
		const { type, state } = part as { type?: string; state?: string };
		return (
			typeof type === 'string' &&
			coachContinuationTools.has(type) &&
			(state === 'output-available' || state === 'output-error' || state === 'approval-responded')
		);
	});
}

/** Send only the latest user turn or tool continuation; server loads the rest from storage. */
export function minimalAgentClientMessages(
	messages: SuperAgentClientMessage[]
): SuperAgentClientMessage[] {
	if (messages.length === 0) return [];
	if (isAgentToolContinuation(messages)) {
		const last = messages.at(-1);
		return last ? [last] : [];
	}
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index].role === 'user') return [messages[index]];
	}
	const last = messages.at(-1);
	return last && last.role !== 'system' ? [last] : [];
}

export function textFromAgentParts(
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
