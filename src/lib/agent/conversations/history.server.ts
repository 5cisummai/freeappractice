import { MAX_AGENT_MESSAGES, type AgentRequest } from '$lib/agent/request';
import type { AgentUIMessage } from '$lib/agent/agent.server';
import type { ConversationMessage } from './store.server';
import {
	shouldIncludeConversationRowForUi,
	toAgentUiMessageFromConversationRow
} from '$lib/agent/conversations/messages';

type ToolPartRecord = {
	[key: string]: unknown;
	type?: unknown;
	state?: unknown;
	toolCallId?: unknown;
	input?: unknown;
	approval?: unknown;
};

function asToolPart(value: unknown): ToolPartRecord | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const part = value as ToolPartRecord;
	return typeof part.type === 'string' && part.type.startsWith('tool-') ? part : null;
}

function findToolPart(parts: unknown[], state: string): ToolPartRecord | null {
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const part = asToolPart(parts[index]);
		if (part?.state === state) return part;
	}
	return null;
}

function asApproval(value: unknown): { id?: unknown; signature?: unknown } | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as { id?: unknown; signature?: unknown };
}

/** Rebuild an approval response with the pending tool input and metadata from storage. */
export function reconstructApprovalContinuationMessage(
	storedAssistant: ConversationMessage,
	clientAssistant: AgentRequest['messages'][number]
): AgentUIMessage | null {
	const storedPart = findToolPart(storedAssistant.parts, 'approval-requested');
	const clientPart = findToolPart(clientAssistant.parts, 'approval-responded');
	if (
		!storedPart ||
		!clientPart ||
		storedPart.type !== clientPart.type ||
		storedPart.toolCallId !== clientPart.toolCallId
	)
		return null;

	const storedApproval = asApproval(storedPart.approval);
	const clientApproval = asApproval(clientPart.approval);
	if (
		!storedApproval ||
		typeof storedApproval.id !== 'string' ||
		!clientApproval ||
		clientApproval.id !== storedApproval.id ||
		typeof (clientApproval as { approved?: unknown }).approved !== 'boolean'
	)
		return null;

	const storedMessage = toAgentUiMessageFromConversationRow(storedAssistant);
	if (!storedMessage) return null;

	let replaced = false;
	const parts = storedMessage.parts.map((part) => {
		const candidate = asToolPart(part);
		if (
			replaced ||
			!candidate ||
			candidate.type !== storedPart.type ||
			candidate.toolCallId !== storedPart.toolCallId ||
			candidate.state !== 'approval-requested'
		)
			return part;

		replaced = true;
		return {
			...candidate,
			state: 'approval-responded',
			approval: {
				id: storedApproval.id,
				approved: (clientApproval as { approved: boolean }).approved,
				...(typeof storedApproval.signature === 'string'
					? { signature: storedApproval.signature }
					: {})
			}
		};
	}) as AgentUIMessage['parts'];

	return replaced
		? {
				...storedMessage,
				...(clientAssistant.id ? { id: clientAssistant.id } : {}),
				parts
			}
		: null;
}

export function buildAgentUiMessages(input: {
	stored: ConversationMessage[];
	context: Record<string, unknown>;
	clientMessages: AgentRequest['messages'];
	isContinuation: boolean;
	continuationMessage?: AgentUIMessage;
	streamingAssistantMessageId?: string;
}): { messages: AgentUIMessage[]; historySummary?: string } {
	const stored = input.stored;
	const uiMessages = stored
		.filter((row) => shouldIncludeConversationRowForUi(row, input))
		.map(toAgentUiMessageFromConversationRow)
		.filter((message): message is AgentUIMessage => message !== null);

	if (input.isContinuation) {
		const continuationAssistant =
			input.continuationMessage ??
			[...input.clientMessages].reverse().find((message) => message.role === 'assistant');
		if (continuationAssistant) {
			const lastAssistantIndex = uiMessages.findLastIndex(
				(message) => message.role === 'assistant'
			);
			if (lastAssistantIndex >= 0) {
				uiMessages[lastAssistantIndex] = {
					...uiMessages[lastAssistantIndex],
					...(continuationAssistant.id ? { id: continuationAssistant.id } : {}),
					parts: continuationAssistant.parts as AgentUIMessage['parts']
				};
			} else {
				uiMessages.push(continuationAssistant as AgentUIMessage);
			}
		}
	}

	const historySummary =
		typeof input.context.historySummary === 'string' ? input.context.historySummary : undefined;

	if (uiMessages.length === 0 && input.clientMessages.length > 0) {
		return {
			messages: input.clientMessages.slice(-MAX_AGENT_MESSAGES) as AgentUIMessage[],
			historySummary
		};
	}

	return {
		messages: uiMessages.slice(-MAX_AGENT_MESSAGES),
		historySummary
	};
}
