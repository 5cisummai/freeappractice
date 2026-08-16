import { randomUUID } from 'node:crypto';
import { generateText } from 'ai';
import { and, asc, desc, eq, isNull, max } from 'drizzle-orm';
import { CONVERSATION_TITLE_MODEL } from '$lib/ai/ai-models-config';
import { openaiModel } from '$lib/ai/service.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { logger } from '$lib/server/logger';
import { conversationMessages, conversations, coachAudits } from '$lib/server/neon/schema';

export type ConversationSurface = 'coach' | 'question';

export type ConversationContext = {
	page?: 'coach' | 'practice' | 'progress' | 'history' | 'insights';
	questionId?: string;
	questionType?: 'mcq' | 'frq';
	frqAttemptId?: string;
	quizId?: string;
};

export type ConversationMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	parts: unknown[];
	position: number;
	status: string;
	clientMessageId?: string | null;
};

export class ConversationAccessError extends Error {
	constructor(
		message: string,
		readonly status: 404 | 409
	) {
		super(message);
		this.name = 'ConversationAccessError';
	}
}

function normalizeSurface(value: string | undefined): ConversationSurface {
	return value === 'question' ? 'question' : 'coach';
}

function safeContext(value: ConversationContext | undefined): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(value ?? {}).filter(([, item]) => typeof item === 'string' && item.trim())
	);
}

const DEFAULT_TITLES: Record<ConversationSurface, string> = {
	coach: 'Coach',
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

function fallbackConversationTitle(prompt: string, surface: ConversationSurface): string {
	return sanitizeConversationTitle(prompt) ?? DEFAULT_TITLES[surface];
}

export async function generateConversationTitle(
	prompt: string,
	surface: ConversationSurface
): Promise<string> {
	const fallback = fallbackConversationTitle(prompt, surface);
	const doneAiCall = logger.aiCall('generateConversationTitle', CONVERSATION_TITLE_MODEL);
	try {
		const { text, usage } = await generateText({
			model: openaiModel(CONVERSATION_TITLE_MODEL),
			system:
				'Write a short conversation title for this student message. 3 to 5 words. Return only the title. No quotes.',
			prompt: prompt.trim().slice(0, 500),
			maxOutputTokens: 40,
			providerOptions: {
				openai: {
					reasoningEffort: 'none'
				}
			}
		});
		doneAiCall({ completionTokens: usage.outputTokens });
		return sanitizeConversationTitle(text) ?? fallback;
	} catch (error) {
		logger.warn('Conversation title generation failed', { error });
		return fallback;
	}
}

export async function createConversation(
	userId: string,
	input: {
		surface: ConversationSurface;
		title?: string;
		context?: ConversationContext;
		id?: string;
	}
): Promise<string> {
	const id = input.id?.trim() || randomUUID();
	await getNeonDatabase()
		.insert(conversations)
		.values({
			id,
			userId,
			title:
				sanitizeConversationTitle(input.title ?? '') ||
				DEFAULT_TITLES[normalizeSurface(input.surface)],
			surface: normalizeSurface(input.surface),
			context: safeContext(input.context)
		})
		.onConflictDoNothing();

	const owned = await getOwnedConversation(userId, id);
	if (!owned) throw new Error('Conversation could not be created');
	return id;
}

export async function getOwnedConversation(userId: string, conversationId: string) {
	const [conversation] = await getNeonDatabase()
		.select()
		.from(conversations)
		.where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
		.limit(1);
	return conversation ?? null;
}

export async function listOwnedConversations(
	userId: string,
	surface: ConversationSurface = 'coach'
) {
	return getNeonDatabase()
		.select({
			id: conversations.id,
			title: conversations.title,
			surface: conversations.surface,
			lastMessageAt: conversations.lastMessageAt,
			createdAt: conversations.createdAt,
			updatedAt: conversations.updatedAt
		})
		.from(conversations)
		.where(
			and(eq(conversations.userId, userId), eq(conversations.surface, normalizeSurface(surface)))
		)
		.orderBy(desc(conversations.updatedAt))
		.limit(50);
}

export async function ensureConversation(
	userId: string,
	input: {
		conversationId?: string;
		surface: ConversationSurface;
		context?: ConversationContext;
		title?: string;
	}
): Promise<string> {
	if (input.conversationId) {
		const existing = await getOwnedConversation(userId, input.conversationId);
		if (!existing) throw new ConversationAccessError('Conversation not found', 404);
		if (normalizeSurface(existing.surface) !== input.surface)
			throw new ConversationAccessError('Conversation surface mismatch', 409);
		return existing.id;
	}
	return createConversation(userId, input);
}

export async function getConversationMessages(
	userId: string,
	conversationId: string,
	limit?: number
): Promise<ConversationMessage[]> {
	const owned = await getOwnedConversation(userId, conversationId);
	if (!owned) throw new Error('Conversation not found');
	const query = getNeonDatabase()
		.select({
			id: conversationMessages.id,
			role: conversationMessages.role,
			content: conversationMessages.content,
			parts: conversationMessages.parts,
			position: conversationMessages.position,
			status: conversationMessages.status,
			clientMessageId: conversationMessages.clientMessageId
		})
		.from(conversationMessages)
		.where(eq(conversationMessages.conversationId, conversationId));
	const rows =
		limit === undefined
			? await query.orderBy(asc(conversationMessages.position))
			: (await query.orderBy(desc(conversationMessages.position)).limit(limit)).reverse();
	return rows.map((row) => ({
		...row,
		role: row.role === 'user' ? 'user' : 'assistant'
	}));
}

async function nextPosition(conversationId: string): Promise<number> {
	const [row] = await getNeonDatabase()
		.select({ position: max(conversationMessages.position) })
		.from(conversationMessages)
		.where(eq(conversationMessages.conversationId, conversationId));
	return Number(row?.position ?? -1) + 1;
}

export async function appendConversationMessage(
	userId: string,
	input: {
		conversationId: string;
		role: 'user' | 'assistant';
		content?: string;
		parts?: unknown[];
		status?: 'streaming' | 'complete' | 'aborted' | 'error';
		clientMessageId?: string;
	}
): Promise<string> {
	const owned = await getOwnedConversation(userId, input.conversationId);
	if (!owned) throw new Error('Conversation not found');

	if (input.clientMessageId) {
		const [existing] = await getNeonDatabase()
			.select({ id: conversationMessages.id })
			.from(conversationMessages)
			.where(
				and(
					eq(conversationMessages.conversationId, input.conversationId),
					eq(conversationMessages.clientMessageId, input.clientMessageId)
				)
			)
			.limit(1);
		if (existing) return existing.id;
	}

	const db = getNeonDatabase();
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const id = randomUUID();
		const position = await nextPosition(input.conversationId);
		const [inserted] = await db
			.insert(conversationMessages)
			.values({
				id,
				conversationId: input.conversationId,
				position,
				role: input.role,
				content: input.content ?? '',
				parts: input.parts ?? [],
				status: input.status ?? 'complete',
				clientMessageId: input.clientMessageId,
				createdAt: new Date()
			})
			.onConflictDoNothing()
			.returning({ id: conversationMessages.id });

		if (inserted) {
			await db
				.update(conversations)
				.set({ lastMessageAt: new Date(), updatedAt: new Date() })
				.where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, userId)));
			return inserted.id;
		}

		if (input.clientMessageId) {
			const [existing] = await db
				.select({ id: conversationMessages.id })
				.from(conversationMessages)
				.where(
					and(
						eq(conversationMessages.conversationId, input.conversationId),
						eq(conversationMessages.clientMessageId, input.clientMessageId)
					)
				)
				.limit(1);
			if (existing) return existing.id;
		}
	}

	throw new Error('Conversation message could not be stored');
}

export async function markConversationMessageStreaming(
	userId: string,
	messageId: string
): Promise<void> {
	const [message] = await getNeonDatabase()
		.select({ conversationId: conversationMessages.conversationId })
		.from(conversationMessages)
		.innerJoin(conversations, eq(conversations.id, conversationMessages.conversationId))
		.where(and(eq(conversationMessages.id, messageId), eq(conversations.userId, userId)))
		.limit(1);
	if (!message) throw new Error('Conversation message not found');

	await getNeonDatabase()
		.update(conversationMessages)
		.set({ status: 'streaming', updatedAt: new Date() })
		.where(eq(conversationMessages.id, messageId));
}

export async function finalizeConversationMessage(
	userId: string,
	messageId: string,
	input: {
		content: string;
		parts: unknown[];
		status: 'complete' | 'aborted' | 'error';
	}
): Promise<void> {
	const [message] = await getNeonDatabase()
		.select({ conversationId: conversationMessages.conversationId })
		.from(conversationMessages)
		.innerJoin(conversations, eq(conversations.id, conversationMessages.conversationId))
		.where(and(eq(conversationMessages.id, messageId), eq(conversations.userId, userId)))
		.limit(1);
	if (!message) throw new Error('Conversation message not found');

	await getNeonDatabase()
		.update(conversationMessages)
		.set({
			content: input.content,
			parts: input.parts,
			status: input.status,
			updatedAt: new Date()
		})
		.where(eq(conversationMessages.id, messageId));

	await getNeonDatabase()
		.update(conversations)
		.set({ lastMessageAt: new Date(), updatedAt: new Date() })
		.where(eq(conversations.id, message.conversationId));
}

export async function linkCoachAuditToConversation(
	userId: string,
	auditId: string,
	conversationId: string,
	messageId?: string
): Promise<void> {
	await getNeonDatabase()
		.update(coachAudits)
		.set({ conversationId, messageId, updatedAt: new Date() })
		.where(and(eq(coachAudits.id, auditId), eq(coachAudits.userId, userId)));
}

export async function linkCoachAuditsToAssistantMessage(
	userId: string,
	conversationId: string,
	messageId: string,
	parts: unknown[]
): Promise<void> {
	const toolParts = parts.flatMap((part) => {
		if (!part || typeof part !== 'object') return [];
		const item = part as Record<string, unknown>;
		if (typeof item.type !== 'string' || !item.type.startsWith('tool-')) return [];
		const toolName = item.type.slice('tool-'.length);
		return toolName === 'update_goals' || toolName === 'update_study_plan' ? [{ toolName }] : [];
	});
	for (const toolPart of toolParts) {
		const [audit] = await getNeonDatabase()
			.select({ id: coachAudits.id })
			.from(coachAudits)
			.where(
				and(
					eq(coachAudits.userId, userId),
					eq(coachAudits.conversationId, conversationId),
					eq(coachAudits.toolName, toolPart.toolName),
					isNull(coachAudits.messageId)
				)
			)
			.orderBy(desc(coachAudits.createdAt))
			.limit(1);
		if (audit) {
			await linkCoachAuditToConversation(userId, audit.id, conversationId, messageId);
		}
	}
}
