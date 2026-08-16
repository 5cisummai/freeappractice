import { json } from '@sveltejs/kit';
import { auth } from '$lib/auth/server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import {
	findOrganizationByShareToken,
	listUserOrganizations
} from '$lib/auth/organization-queries.server';
import { isShareToken } from '$lib/auth/organization-types';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json().catch(() => null)) as { token?: unknown } | null;
		const token = typeof body?.token === 'string' ? body.token.trim() : '';
		if (!isShareToken(token)) {
			return json({ error: 'That invite link is invalid.' }, { status: 400 });
		}

		const organization = await findOrganizationByShareToken(token);
		if (!organization || organization.orgType !== 'group') {
			return json({ error: 'That invite link is invalid or expired.' }, { status: 404 });
		}

		const memberships = await listUserOrganizations(userId);
		if (memberships.some((org) => org.id === organization.id)) {
			await auth.api.setActiveOrganization({
				body: { organizationId: organization.id },
				headers: event.request.headers
			});
			return json({ organizationId: organization.id, alreadyMember: true });
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
		return json({ organizationId: organization.id, alreadyMember: false });
	},
	{ logLabel: 'org join', errorMessage: 'Could not join that organization.' }
);
