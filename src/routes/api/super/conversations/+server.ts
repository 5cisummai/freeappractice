import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { listOwnedConversations } from '$lib/super/conversations.server';

export const GET: RequestHandler = withAuthedHandler(
	async (_event, userId) => {
		const items = await listOwnedConversations(userId, 'coach');
		return json({
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
