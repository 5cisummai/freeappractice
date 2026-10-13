import { z } from 'zod';
import type { RequestHandler } from './$types';
import { isAdminUser } from '#lib/auth/admin.server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	createSuperGrant,
	getSuperAdminOverview,
	revokeSuperGrant
} from '#lib/billing/admin.server.js';

const grantSchema = z
	.object({
		userId: z.string().trim().min(1).max(200),
		startsAt: z.string().datetime(),
		expiresAt: z.string().datetime(),
		reason: z.string().trim().min(3).max(500)
	})
	.strict();

const revokeSchema = z.object({ grantId: z.string().trim().min(1).max(100) }).strict();

function requireAdmin(user: { id: string }): Response | null {
	return isAdminUser(user)
		? null
		: Response.json({ error: 'Admin access required' }, { status: 403 });
}

export const GET: RequestHandler = withAuthedHandler(
	async (event) => {
		const denial = requireAdmin(event.locals.user!);
		if (denial) return denial;
		return Response.json(await getSuperAdminOverview());
	},
	{ logLabel: 'Get Super admin overview error', errorMessage: 'Failed to load Super admin data' }
);

export const POST: RequestHandler = withAuthedHandler(
	async (event) => {
		const denial = requireAdmin(event.locals.user!);
		if (denial) return denial;
		const parsed = grantSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Invalid Super grant' }, { status: 400 });
		const startsAt = new Date(parsed.data.startsAt);
		const expiresAt = new Date(parsed.data.expiresAt);
		if (expiresAt <= startsAt)
			return Response.json({ error: 'The grant must expire after it starts' }, { status: 400 });

		return Response.json({
			grant: await createSuperGrant({
				...parsed.data,
				startsAt,
				expiresAt,
				createdBy: event.locals.user!.id
			})
		});
	},
	{ logLabel: 'Create Super grant error', errorMessage: 'Failed to create Super grant' }
);

export const DELETE: RequestHandler = withAuthedHandler(
	async (event) => {
		const denial = requireAdmin(event.locals.user!);
		if (denial) return denial;
		const parsed = revokeSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) return Response.json({ error: 'Invalid grant' }, { status: 400 });
		const revoked = await revokeSuperGrant(parsed.data.grantId);
		return revoked
			? Response.json({ revoked: true })
			: Response.json({ error: 'Active grant not found' }, { status: 404 });
	},
	{ logLabel: 'Revoke Super grant error', errorMessage: 'Failed to revoke Super grant' }
);
