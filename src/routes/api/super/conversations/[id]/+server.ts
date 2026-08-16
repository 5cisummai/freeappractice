import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { readJsonBody } from '$lib/server/request-body.server';
import {
	ConversationAccessError,
	deleteOwnedConversation,
	getConversationMessages,
	getOwnedConversation,
	renameOwnedConversation
} from '$lib/super/conversations.server';

const renameConversationSchema = z
	.object({
		title: z.string().trim().min(1).max(160)
	})
	.strict();

export const GET: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const conversationId = event.params.id;
		if (!conversationId) return json({ error: 'Conversation not found' }, { status: 404 });
		const conversation = await getOwnedConversation(userId, conversationId);
		if (!conversation) return json({ error: 'Conversation not found' }, { status: 404 });
		const messages = await getConversationMessages(userId, conversationId);
		return json({
			id: conversation.id,
			surface: conversation.surface,
			context: conversation.context,
			messages: messages
				.filter((message) => message.status !== 'streaming' && message.parts.length > 0)
				.map((message) => ({
					id: message.id,
					role: message.role,
					parts: message.parts
				}))
		});
	},
	{ logLabel: 'Super conversation load error', errorMessage: 'Failed to load conversation' }
);

export const PATCH: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const conversationId = event.params.id;
		if (!conversationId) return json({ error: 'Conversation not found' }, { status: 404 });

		let body: unknown;
		try {
			body = await readJsonBody(event.request, 4 * 1024);
		} catch {
			return json({ error: 'Invalid conversation update' }, { status: 400 });
		}

		const parsed = renameConversationSchema.safeParse(body);
		if (!parsed.success) return json({ error: 'Invalid conversation update' }, { status: 400 });

		try {
			const title = await renameOwnedConversation(userId, conversationId, parsed.data.title);
			return json({ id: conversationId, title });
		} catch (error) {
			if (error instanceof ConversationAccessError) {
				return json({ error: error.message }, { status: error.status });
			}
			throw error;
		}
	},
	{ logLabel: 'Super conversation rename error', errorMessage: 'Failed to rename conversation' }
);

export const DELETE: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const conversationId = event.params.id;
		if (!conversationId) return json({ error: 'Conversation not found' }, { status: 404 });

		try {
			await deleteOwnedConversation(userId, conversationId);
			return json({ ok: true });
		} catch (error) {
			if (error instanceof ConversationAccessError) {
				return json({ error: error.message }, { status: error.status });
			}
			throw error;
		}
	},
	{ logLabel: 'Super conversation delete error', errorMessage: 'Failed to delete conversation' }
);
