import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { getConversationMessages, getOwnedConversation } from '$lib/super/conversations.server';

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
