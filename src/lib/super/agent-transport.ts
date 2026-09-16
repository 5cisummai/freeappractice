import { DefaultChatTransport } from 'ai';
import { apiFetch } from '$lib/client/api';
import type { SuperAgentUIMessage } from '$lib/super/agent.server';
import {
	MAX_SUPER_AGENT_MESSAGES,
	minimalSuperAgentClientMessages,
	type CoachThinkingMode,
	type SuperAgentContext
} from '$lib/super/agent-request';
import type { CoachComposerActionId } from '$lib/super/coach-composer-actions';

export type SuperAgentTransportOptions = {
	getSessionId: () => string;
	getConversationId: () => string | undefined;
	setConversationId: (id: string) => void;
	getContext: () => SuperAgentContext;
	onUsageWarning?: (response: Response) => void;
	onConversationIdChange?: () => void;
	getThinkingMode?: () => CoachThinkingMode;
	getCoachActions?: () => CoachComposerActionId[];
};

/** Shared AI SDK transport for every Super Agent UI surface. */
export function createSuperAgentTransport(
	options: SuperAgentTransportOptions
): DefaultChatTransport<SuperAgentUIMessage> {
	return new DefaultChatTransport<SuperAgentUIMessage>({
		api: '/api/super/agent',
		fetch: async (url, init) => {
			const response = await apiFetch(String(url), init);
			const responseConversationId = response.headers.get('X-Super-Conversation-Id');
			if (responseConversationId && responseConversationId !== options.getConversationId()) {
				options.setConversationId(responseConversationId);
				options.onConversationIdChange?.();
			}
			options.onUsageWarning?.(response);
			return response;
		},
		prepareSendMessagesRequest: ({ messages }) => {
			const conversationId = options.getConversationId();
			const coachActions = options.getCoachActions?.() ?? [];
			const thinkingMode = options.getThinkingMode?.();
			return {
				body: {
					sessionId: options.getSessionId(),
					context: options.getContext(),
					...(conversationId ? { conversationId } : {}),
					...(coachActions.length ? { coachActions } : {}),
					...(thinkingMode ? { thinkingMode } : {}),
					messages: conversationId
						? minimalSuperAgentClientMessages(messages)
						: messages.slice(-MAX_SUPER_AGENT_MESSAGES)
				}
			};
		}
	});
}
