import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { inviteLinkForOrganization } from '#lib/auth/organizations.server.js';
import { getSiteUrl } from '#lib/site-url.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json().catch(() => null)) as {
			organizationId?: unknown;
		} | null;
		const organizationId =
			typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
		if (!organizationId) {
			return Response.json({ error: 'Organization is required.' }, { status: 400 });
		}

		const url = await inviteLinkForOrganization(userId, organizationId, getSiteUrl());
		if (!url) {
			return Response.json(
				{ error: 'You cannot create an invite link for that organization.' },
				{ status: 403 }
			);
		}
		return Response.json({ url });
	},
	{ logLabel: 'org invite link', errorMessage: 'Could not create an invite link.' }
);
