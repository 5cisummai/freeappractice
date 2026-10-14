import { auth } from '#lib/auth/server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	findOrganizationByShareToken,
	listUserOrganizations
} from '#lib/auth/organization-queries.server.js';
import { isShareToken } from '#lib/auth/organization-types.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json().catch(() => null)) as { token?: unknown } | null;
		const token = typeof body?.token === 'string' ? body.token.trim() : '';
		if (!isShareToken(token)) {
			return Response.json({ error: 'That invite link is invalid.' }, { status: 400 });
		}

		const organization = await findOrganizationByShareToken(token);
		if (!organization || organization.orgType !== 'group') {
			return Response.json({ error: 'That invite link is invalid or expired.' }, { status: 404 });
		}

		const memberships = await listUserOrganizations(userId);
		if (memberships.some((org) => org.id === organization.id)) {
			await auth.api.setActiveOrganization({
				body: { organizationId: organization.id },
				headers: event.request.headers
			});
			return Response.json({ organizationId: organization.id, alreadyMember: true });
		}

		await auth.api.addMember({
			body: {
				userId,
				role: 'member',
				organizationId: organization.id
			}
		});
		await auth.api.setActiveOrganization({
			body: { organizationId: organization.id },
			headers: event.request.headers
		});
		return Response.json({ organizationId: organization.id, alreadyMember: false });
	},
	{ logLabel: 'org join', errorMessage: 'Could not join that organization.' }
);
