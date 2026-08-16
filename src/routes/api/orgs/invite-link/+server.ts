import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { inviteLinkForOrganization } from '$lib/auth/organizations.server';
import { getSiteUrl } from '$lib/site-url';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json().catch(() => null)) as {
			organizationId?: unknown;
		} | null;
		const organizationId =
			typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
		if (!organizationId) {
			return json({ error: 'Organization is required.' }, { status: 400 });
		}

		const url = await inviteLinkForOrganization(userId, organizationId, getSiteUrl());
		if (!url) {
			return json(
				{ error: 'You cannot create an invite link for that organization.' },
				{ status: 403 }
			);
		}
		return json({ url });
	},
	{ logLabel: 'org invite link', errorMessage: 'Could not create an invite link.' }
);
