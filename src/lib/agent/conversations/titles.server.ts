import { generateText } from 'ai';
import { and, eq, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { conversations } from '$lib/server/neon/schema';
import { logger } from '$lib/server/logger';
import type { ConversationSurface } from './store.server';
export const CONVERSATION_TITLE_MODEL = 'openai/gpt-6-luna';

const DEFAULT_TITLES: Record<ConversationSurface, string> = {
	coach: 'Pip',
	question: 'Question help'
};

export function sanitizeConversationTitle(raw: string): string | null {
	const cleaned = raw
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^["'`]+|["'`]+$/g, '')
		.replace(/[.]+$/g, '')
		.trim()
		.slice(0, 160);
	return cleaned || null;
}

export function fallbackConversationTitle(prompt: string, surface: ConversationSurface): string {
	return sanitizeConversationTitle(prompt) ?? DEFAULT_TITLES[surface];
}

export async function generateConversationTitle(
	prompt: string,
	surface: ConversationSurface,
	timeout = 8_000
): Promise<string> {
	const fallback = fallbackConversationTitle(prompt, surface);
	const doneAiCall = logger.aiCall('generateConversationTitle', CONVERSATION_TITLE_MODEL);
	try {
		const { text, usage } = await generateText({
			model: CONVERSATION_TITLE_MODEL,
			timeout,
			instructions:
				'Write a short conversation title for this student message. 3 to 5 words. Return only the title. No quotes.',
			prompt: prompt.trim().slice(0, 500),
			maxOutputTokens: 40,
			providerOptions: {
				openai: {
					reasoningEffort: 'low'
				}
			}
		});
		doneAiCall({ completionTokens: usage.outputTokens });
		return sanitizeConversationTitle(text) ?? fallback;
	} catch (error) {
		logger.warn('Conversation title generation failed', { error });
		throw error;
	}
}

/** A manual rename or another generated title wins over this background result. */
export async function updateAutomaticTitle(
	userId: string,
	conversationId: string,
	prompt: string,
	timeout = 8_000
): Promise<void> {
	const title = await generateConversationTitle(prompt, 'coach', timeout);
	await getNeonDatabase()
		.update(conversations)
		.set({
			title,
			context: sql`coalesce(${conversations.context}, '{}'::jsonb) - 'automaticTitlePending' - 'automaticTitlePrompt'`,
			updatedAt: new Date()
		})
		.where(
			and(
				eq(conversations.id, conversationId),
				eq(conversations.userId, userId),
				sql`${conversations.context} ->> 'automaticTitlePending' = 'true'`
			)
		);
}
