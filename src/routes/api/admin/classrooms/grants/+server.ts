import { z } from 'zod';
import { isAdminUser } from '#lib/auth/admin.server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	grantClassroomCreationAccess,
	listClassroomCreationAccess,
	revokeClassroomCreationAccess
} from '#lib/auth/organization-queries.server.js';

const userSchema = z.object({ userId: z.string().trim().min(1).max(200) }).strict();

function requireAdmin(user: { id: string }): Response | null {
	return isAdminUser(user)
		? null
		: Response.json({ error: 'Admin access required' }, { status: 403 });
}

export const GET = withAuthedHandler(
	async (event) => {
		const denial = requireAdmin(event.locals.user!);
		if (denial) return denial;
		return Response.json({ grants: await listClassroomCreationAccess() });
	},
	{ logLabel: 'Classroom grant list error', errorMessage: 'Failed to list classroom grants' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const denial = requireAdmin(event.locals.user!);
		if (denial) return denial;
		const parsed = userSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success)
			return Response.json({ error: 'A valid userId is required.' }, { status: 400 });
		await grantClassroomCreationAccess(parsed.data.userId, userId);
		return Response.json({ granted: true, userId: parsed.data.userId });
	},
	{ logLabel: 'Classroom grant create error', errorMessage: 'Failed to grant classroom access' }
);

export const DELETE = withAuthedHandler(
	async (event) => {
		const denial = requireAdmin(event.locals.user!);
		if (denial) return denial;
		const parsed = userSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success)
			return Response.json({ error: 'A valid userId is required.' }, { status: 400 });
		const revoked = await revokeClassroomCreationAccess(parsed.data.userId);
		return revoked
			? Response.json({ revoked: true, userId: parsed.data.userId })
			: Response.json({ error: 'Active classroom grant not found.' }, { status: 404 });
	},
	{ logLabel: 'Classroom grant revoke error', errorMessage: 'Failed to revoke classroom access' }
);
