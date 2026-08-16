import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import { CONVERSATION_TITLE_MODEL } from '$lib/ai/ai-models-config';
import { openaiModel } from '$lib/ai/service.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { logger } from '$lib/server/logger';
import { conversations } from '$lib/server/neon/schema';
import {
	MAX_SUPER_AGENT_MESSAGES,
	textFromSuperAgentParts,
	type SuperAgentRequest
} from '$lib/super/agent-request';
import type { SuperAgentUIMessage } from '$lib/super/coach.server';
import {
	getConversationMessages,
	getOwnedConversation,
	type ConversationMessage
} from '$lib/super/conversations.server';
import {
	shouldIncludeConversationRowForUi,
	toSuperAgentUiMessageFromConversationRow
} from '$lib/super/agent-ui-messages';

const MAX_HISTORY_SUMMARY_CHARS = 4_000;
const MAX_SUMMARY_SOURCE_CHARS = 2_000;

function messageTranscript(row: ConversationMessage): string {
	const fromParts = textFromSuperAgentParts(
		row.parts as Array<{ type?: string; text?: string }> | undefined
	);
	const text = (fromParts || row.content).trim();
	return text.slice(0, MAX_SUMMARY_SOURCE_CHARS);
}

async function rollConversationHistorySummary(input: {
	previousSummary?: string;
	droppedMessages: ConversationMessage[];
}): Promise<string> {
	const transcript = input.droppedMessages
		.map((message) => `${message.role}: ${messageTranscript(message)}`)
		.join('\n')
		.trim();
	if (!transcript && !input.previousSummary) return '';

	const doneAiCall = logger.aiCall('rollConversationHistorySummary', CONVERSATION_TITLE_MODEL);
	try {
		const { text, usage } = await generateText({
			model: openaiModel(CONVERSATION_TITLE_MODEL),
			system:
				'Summarize this AP Coach conversation for continuity. Keep study goals, weak units, plans, practice-question topics, and decisions. Max 500 words. No greeting.',
			prompt: input.previousSummary
				? `Previous summary:\n${input.previousSummary}\n\nNew messages to fold in:\n${transcript}`
				: transcript,
			maxOutputTokens: 700,
			providerOptions: {
				openai: {
					reasoningEffort: 'none'
				}
			}
		});
		doneAiCall({ completionTokens: usage.outputTokens });
		return text.trim().slice(0, MAX_HISTORY_SUMMARY_CHARS);
	} catch (error) {
		logger.warn('Conversation history summary failed', { error });
		return input.previousSummary ?? '';
	}
}

async function saveConversationHistorySummary(
	userId: string,
	conversationId: string,
	summary: string,
	summarizedThroughPosition: number
): Promise<void> {
	const owned = await getOwnedConversation(userId, conversationId);
	if (!owned) throw new Error('Conversation not found');

	await getNeonDatabase()
		.update(conversations)
		.set({
			context: {
				...(owned.context ?? {}),
				historySummary: summary,
				summarizedThroughPosition
			},
			updatedAt: new Date()
		})
		.where(eq(conversations.id, conversationId));
}

export async function ensureConversationHistorySummary(
	userId: string,
	conversationId: string,
	storedMessages: ConversationMessage[]
): Promise<string | undefined> {
	const completeMessages = storedMessages.filter(
		(message) => message.status !== 'streaming' && messageTranscript(message).length > 0
	);
	if (completeMessages.length <= MAX_SUPER_AGENT_MESSAGES) return undefined;

	const droppedMessages = completeMessages.slice(
		0,
		completeMessages.length - MAX_SUPER_AGENT_MESSAGES
	);
	if (droppedMessages.length === 0) return undefined;

	const summarizedThroughPosition = droppedMessages.at(-1)?.position ?? -1;
	const owned = await getOwnedConversation(userId, conversationId);
	const context = (owned?.context ?? {}) as Record<string, unknown>;
	const existingSummary =
		typeof context.historySummary === 'string' ? context.historySummary : undefined;
	const existingThrough =
		typeof context.summarizedThroughPosition === 'number' ? context.summarizedThroughPosition : -1;

	if (summarizedThroughPosition <= existingThrough) {
		return existingSummary;
	}

	const newDropped = droppedMessages.filter((message) => message.position > existingThrough);
	const summary = await rollConversationHistorySummary({
		previousSummary: existingSummary,
		droppedMessages: newDropped.length > 0 ? newDropped : droppedMessages
	});
	if (!summary) return existingSummary;

	await saveConversationHistorySummary(userId, conversationId, summary, summarizedThroughPosition);
	return summary;
}

export async function buildSuperAgentUiMessages(input: {
	userId: string;
	conversationId: string;
	clientMessages: SuperAgentRequest['messages'];
	isContinuation: boolean;
	streamingAssistantMessageId?: string;
}): Promise<{ messages: SuperAgentUIMessage[]; historySummary?: string }> {
	const stored = await getConversationMessages(input.userId, input.conversationId);
	const uiMessages = stored
		.filter((row) => shouldIncludeConversationRowForUi(row, input))
		.map(toSuperAgentUiMessageFromConversationRow)
		.filter((message): message is SuperAgentUIMessage => message !== null);

	if (input.isContinuation) {
		const clientAssistant = [...input.clientMessages]
			.reverse()
			.find((message) => message.role === 'assistant');
		if (clientAssistant) {
			const lastAssistantIndex = uiMessages.findLastIndex(
				(message) => message.role === 'assistant'
			);
			if (lastAssistantIndex >= 0) {
				uiMessages[lastAssistantIndex] = {
					...uiMessages[lastAssistantIndex],
					parts: clientAssistant.parts as SuperAgentUIMessage['parts']
				};
			} else {
				uiMessages.push(clientAssistant as SuperAgentUIMessage);
			}
		}
	}

	const historySummary = await ensureConversationHistorySummary(
		input.userId,
		input.conversationId,
		stored
	);

	if (uiMessages.length === 0 && input.clientMessages.length > 0) {
		return {
			messages: input.clientMessages.slice(-MAX_SUPER_AGENT_MESSAGES) as SuperAgentUIMessage[],
			historySummary
		};
	}

	return {
		messages: uiMessages.slice(-MAX_SUPER_AGENT_MESSAGES),
		historySummary
	};
}
