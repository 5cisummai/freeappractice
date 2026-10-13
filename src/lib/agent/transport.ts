import { DefaultChatTransport } from 'ai';
import { apiFetch } from '#lib/client/api.js';
import type { AgentUIMessage } from '#lib/agent/agent.server.js';
import {
	MAX_AGENT_MESSAGES,
	minimalAgentClientMessages,
	type CoachThinkingMode,
	type AgentContext
} from '#lib/agent/request.js';
import type { CoachComposerActionId } from '#lib/agent/personalization/composer-actions.js';

export type AgentTransportOptions = {
	getSessionId: () => string;
	getConversationId: () => string | undefined;
	setConversationId: (id: string) => void;
	getContext: () => AgentContext;
	onUsageWarning?: (response: Response) => void;
	onConversationIdChange?: () => void;
	onImageUploaded?: (id: string) => void;
	getThinkingMode?: () => CoachThinkingMode;
	getCoachActions?: () => CoachComposerActionId[];
};

/** Shared AI SDK transport for every Super Agent UI surface. */
export function createAgentTransport(
	options: AgentTransportOptions
): DefaultChatTransport<AgentUIMessage> {
	return new DefaultChatTransport<AgentUIMessage>({
		api: '/api/super/agent',
		fetch: async (url, init) => {
			const response = await apiFetch(String(url), init);
			const responseConversationId = response.headers.get('X-Super-Conversation-Id');
			if (responseConversationId && responseConversationId !== options.getConversationId()) {
				options.setConversationId(responseConversationId);
				options.onConversationIdChange?.();
			}
			options.onUsageWarning?.(response);
			const imageId = response.headers.get('X-Coach-Image-Id');
			if (imageId) options.onImageUploaded?.(imageId);
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
						? minimalAgentClientMessages(messages)
						: messages.slice(-MAX_AGENT_MESSAGES)
				}
			};
		}
	});
}
