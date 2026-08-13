import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { isAdminUser } from '$lib/auth/admin.server';
import { auth } from '$lib/auth/server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import {
	grantIndefiniteSuperToUser,
	revokeActiveSuperGrantsForUser
} from '$lib/super/admin.server';

const schema = z
	.object({
		userId: z.string().trim().min(1).max(200),
		action: z.enum(['grant_super', 'revoke_super', 'ban', 'unban'])
	})
	.strict();

export const POST = withAuthedHandler(
	async (event) => {
		if (!isAdminUser(event.locals.user!)) {
			return json({ error: 'Admin access required' }, { status: 403 });
		}
		const parsed = schema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return json({ error: 'Invalid user action' }, { status: 400 });

		const { userId, action } = parsed.data;
		if (userId === event.locals.user!.id && (action === 'ban' || action === 'revoke_super')) {
			return json({ error: 'You cannot perform that action on your own account' }, { status: 400 });
		}

		switch (action) {
			case 'grant_super': {
				const result = await grantIndefiniteSuperToUser(userId, event.locals.user!.id);
				return json(
					result.granted
						? { granted: true }
						: { granted: false, message: 'User already has an indefinite Super grant' }
				);
			}
			case 'revoke_super': {
				const revoked = await revokeActiveSuperGrantsForUser(userId);
				return revoked > 0
					? json({ revoked })
					: json({ error: 'No active Super grant found' }, { status: 404 });
			}
			case 'ban':
				await auth.api.banUser({
					headers: event.request.headers,
					body: { userId, banReason: 'Banned by admin' }
				});
				return json({ banned: true });
			case 'unban':
				await auth.api.unbanUser({
					headers: event.request.headers,
					body: { userId }
				});
				return json({ banned: false });
			default: {
				const _exhaustive: never = action;
				return json({ error: `Unhandled action: ${_exhaustive}` }, { status: 400 });
			}
		}
	},
	{ logLabel: 'Admin user action error', errorMessage: 'Failed to update user' }
);
