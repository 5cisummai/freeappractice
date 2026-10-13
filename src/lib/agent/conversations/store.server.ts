import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, isNull, max, ne, or, sql } from 'drizzle-orm';
import { sanitizeConversationTitle, fallbackConversationTitle } from './titles.server';

import { getNeonDatabase } from '#lib/server/neon/db.js';
import { conversationMessages, conversations, coachAudits } from '#lib/server/neon/schema.js';

export type ConversationSurface = 'coach' | 'question';

export type ConversationContext = {
	page?: 'coach' | 'practice' | 'progress' | 'history';
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
		readonly status: 400 | 404 | 409
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

export async function createConversation(
	userId: string,
	input: {
		surface: ConversationSurface;
		title?: string;
		automaticTitlePending?: boolean;
		context?: ConversationContext;
		id?: string;
	}
): Promise<OwnedConversation> {
	const id = input.id?.trim() || randomUUID();
	await getNeonDatabase()
		.insert(conversations)
		.values({
			id,
			userId,
			title:
				sanitizeConversationTitle(input.title ?? '') ||
				fallbackConversationTitle('', normalizeSurface(input.surface)),
			surface: normalizeSurface(input.surface),
			context: {
				...safeContext(input.context),
				...(input.automaticTitlePending
					? { automaticTitlePending: true, automaticTitlePrompt: (input.title ?? '').slice(0, 500) }
					: {})
			}
		})
		.onConflictDoNothing();

	const owned = await getOwnedConversation(userId, id);
	if (!owned) throw new Error('Conversation could not be created');
	return owned;
}

export type OwnedConversation = typeof conversations.$inferSelect;

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

export async function renameOwnedConversation(
	userId: string,
	conversationId: string,
	title: string
): Promise<string> {
	const sanitized = sanitizeConversationTitle(title);
	if (!sanitized) throw new ConversationAccessError('Conversation title is required', 400);

	const [updated] = await getNeonDatabase()
		.update(conversations)
		.set({
			title: sanitized,
			context: sql`coalesce(${conversations.context}, '{}'::jsonb) - 'automaticTitlePending' - 'automaticTitlePrompt'`,
			updatedAt: new Date()
		})
		.where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
		.returning({ title: conversations.title });

	if (!updated) throw new ConversationAccessError('Conversation not found', 404);
	return updated.title;
}

export async function deleteOwnedConversation(
	userId: string,
	conversationId: string
): Promise<void> {
	const [deleted] = await getNeonDatabase()
		.delete(conversations)
		.where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
		.returning({ id: conversations.id });

	if (!deleted) throw new ConversationAccessError('Conversation not found', 404);
}

export async function ensureConversation(
	userId: string,
	input: {
		conversationId?: string;
		surface: ConversationSurface;
		context?: ConversationContext;
		title?: string;
		automaticTitlePending?: boolean;
	}
): Promise<OwnedConversation> {
	if (input.conversationId) {
		const existing = await getOwnedConversation(userId, input.conversationId);
		if (!existing) throw new ConversationAccessError('Conversation not found', 404);
		if (normalizeSurface(existing.surface) !== input.surface)
			throw new ConversationAccessError('Conversation surface mismatch', 409);
		return existing;
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

/** Caller has already verified ownership through ensureConversation. */
export async function getAgentHistory(
	owned: OwnedConversation,
	limit = 96
): Promise<ConversationMessage[]> {
	const rows = await getNeonDatabase()
		.select()
		.from(conversationMessages)
		.where(
			and(
				eq(conversationMessages.conversationId, owned.id),
				ne(conversationMessages.status, 'error'),
				or(
					ne(conversationMessages.content, ''),
					sql`jsonb_array_length(${conversationMessages.parts}) > 0`
				)
			)
		)
		.orderBy(desc(conversationMessages.position))
		.limit(limit);
	return rows.reverse().map((row) => ({
		...row,
		role: row.role === 'user' ? ('user' as const) : ('assistant' as const)
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
	},
	existingConversation?: OwnedConversation
): Promise<string> {
	const owned = existingConversation ?? (await getOwnedConversation(userId, input.conversationId));
	if (!owned || owned.id !== input.conversationId || owned.userId !== userId)
		throw new Error('Conversation not found');

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
		clientMessageId?: string;
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
			...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
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
