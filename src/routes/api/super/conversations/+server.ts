import type { RequestHandler } from './$types';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { listOwnedConversations } from '#lib/agent/conversations/store.server.js';

export const GET: RequestHandler = withAuthedHandler(
	async (_event, userId) => {
		const items = await listOwnedConversations(userId, 'coach');
		return Response.json({
			conversations: items.map((conversation) => ({
				...conversation,
				lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
				createdAt: conversation.createdAt.toISOString(),
				updatedAt: conversation.updatedAt.toISOString()
			}))
		});
	},
	{ logLabel: 'Super conversation list error', errorMessage: 'Failed to list conversations' }
);
