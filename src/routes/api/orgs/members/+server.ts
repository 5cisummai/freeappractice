import { z } from 'zod';
import { auth } from '#lib/auth/server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { getOrganizationTypeForUser } from '#lib/auth/organization-queries.server.js';

const inputSchema = z
	.object({
		organizationId: z.string().trim().min(1),
		action: z.enum(['remove', 'role']),
		memberIdOrEmail: z.string().trim().min(1).optional(),
		memberId: z.string().trim().min(1).optional(),
		role: z.enum(['owner', 'admin', 'member']).optional()
	})
	.strict()
	.superRefine((value, context) => {
		if (value.action === 'remove' && !value.memberIdOrEmail) {
			context.addIssue({ code: 'custom', message: 'memberIdOrEmail is required.' });
		}
		if (value.action === 'role' && (!value.memberId || !value.role)) {
			context.addIssue({ code: 'custom', message: 'memberId and role are required.' });
		}
	});

export const POST = withAuthedHandler(
	async (event, userId) => {
		const parsed = inputSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success) {
			return Response.json(
				{ error: parsed.error.issues[0]?.message ?? 'Invalid member action.' },
				{ status: 400 }
			);
		}
		const orgType = await getOrganizationTypeForUser(parsed.data.organizationId, userId);
		if (orgType !== 'group' && orgType !== 'school') {
			return Response.json(
				{ error: 'Member administration is not available here.' },
				{ status: 403 }
			);
		}
		if (parsed.data.action === 'remove') {
			await auth.api.removeMember({
				body: {
					memberIdOrEmail: parsed.data.memberIdOrEmail!,
					organizationId: parsed.data.organizationId
				},
				headers: event.request.headers
			});
		} else {
			await auth.api.updateMemberRole({
				body: {
					memberId: parsed.data.memberId!,
					role: parsed.data.role!,
					organizationId: parsed.data.organizationId
				},
				headers: event.request.headers
			});
		}
		return Response.json({ updated: true });
	},
	{
		logLabel: 'Organization member mutation error',
		errorMessage: 'Failed to update organization member'
	}
);
