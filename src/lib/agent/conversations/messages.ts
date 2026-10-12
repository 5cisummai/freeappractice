import type { AgentUIMessage } from '$lib/agent/agent.server';
import type { ConversationMessage } from '$lib/agent/conversations/store.server';

export function shouldIncludeConversationRowForUi(
	row: ConversationMessage,
	input: { isContinuation: boolean; streamingAssistantMessageId?: string }
): boolean {
	if (row.status === 'streaming') {
		if (row.id !== input.streamingAssistantMessageId) return false;
		// Fresh turns persist an empty assistant placeholder before streaming starts.
		return input.isContinuation;
	}
	if (row.status === 'error') return false;
	return row.parts.length > 0 || row.content.trim().length > 0;
}

export function toAgentUiMessageFromConversationRow(
	row: ConversationMessage
): AgentUIMessage | null {
	const parts =
		row.parts.length > 0
			? (row.parts as AgentUIMessage['parts'])
			: row.content.trim()
				? [{ type: 'text' as const, text: row.content }]
				: [];
	if (parts.length === 0) return null;

	return {
		id: row.clientMessageId ?? row.id,
		role: row.role,
		parts
	};
}
