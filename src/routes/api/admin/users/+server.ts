import { z } from 'zod';
import { isAdminUser } from '#lib/auth/admin.server.js';
import { auth } from '#lib/auth/server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	grantIndefiniteSuperToUser,
	revokeActiveSuperGrantsForUser
} from '#lib/billing/admin.server.js';

const schema = z
	.object({
		userId: z.string().trim().min(1).max(200),
		action: z.enum(['grant_super', 'revoke_super', 'ban', 'unban'])
	})
	.strict();

export const POST = withAuthedHandler(
	async (event) => {
		if (!isAdminUser(event.locals.user!)) {
			return Response.json({ error: 'Admin access required' }, { status: 403 });
		}
		const parsed = schema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Invalid user action' }, { status: 400 });

		const { userId, action } = parsed.data;
		if (userId === event.locals.user!.id && (action === 'ban' || action === 'revoke_super')) {
			return Response.json(
				{ error: 'You cannot perform that action on your own account' },
				{ status: 400 }
			);
		}

		switch (action) {
			case 'grant_super': {
				const result = await grantIndefiniteSuperToUser(userId, event.locals.user!.id);
				return Response.json(
					result.granted
						? { granted: true }
						: { granted: false, message: 'User already has an indefinite Super grant' }
				);
			}
			case 'revoke_super': {
				const revoked = await revokeActiveSuperGrantsForUser(userId);
				return revoked > 0
					? Response.json({ revoked })
					: Response.json({ error: 'No active Super grant found' }, { status: 404 });
			}
			case 'ban':
				await auth.api.banUser({
					headers: event.request.headers,
					body: { userId, banReason: 'Banned by admin' }
				});
				return Response.json({ banned: true });
			case 'unban':
				await auth.api.unbanUser({
					headers: event.request.headers,
					body: { userId }
				});
				return Response.json({ banned: false });
			default: {
				const _exhaustive: never = action;
				return Response.json({ error: `Unhandled action: ${_exhaustive}` }, { status: 400 });
			}
		}
	},
	{ logLabel: 'Admin user action error', errorMessage: 'Failed to update user' }
);
