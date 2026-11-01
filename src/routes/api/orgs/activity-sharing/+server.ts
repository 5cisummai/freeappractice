import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import {
	getOrganizationActivitySharing,
	setOrganizationActivitySharing
} from '#lib/auth/organization-queries.server.js';
import { OrganizationPermissionError } from '#lib/auth/organization-types.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const organizationId = event.url.searchParams.get('organizationId')?.trim();
		if (!organizationId)
			return Response.json({ error: 'organizationId is required.' }, { status: 400 });
		try {
			const enabled = await getOrganizationActivitySharing(userId, organizationId);
			return Response.json({ organizationId, enabled });
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return Response.json({ error: error.message }, { status: 403 });
			}
			throw error;
		}
	},
	{ logLabel: 'Activity sharing lookup error', errorMessage: 'Failed to load activity sharing' }
);

export const PATCH = withAuthedHandler(
	async (event, userId) => {
		const body = await event.request.json().catch(() => null);
		const organizationId =
			body && typeof body === 'object' && typeof body.organizationId === 'string'
				? body.organizationId.trim()
				: '';
		const enabled =
			body && typeof body === 'object' && typeof body.enabled === 'boolean' ? body.enabled : null;
		if (!organizationId || enabled === null) {
			return Response.json({ error: 'organizationId and enabled are required.' }, { status: 400 });
		}
		try {
			await setOrganizationActivitySharing(userId, organizationId, enabled);
			return Response.json({ organizationId, enabled });
		} catch (error) {
			if (error instanceof OrganizationPermissionError) {
				return Response.json({ error: error.message }, { status: 403 });
			}
			throw error;
		}
	},
	{ logLabel: 'Activity sharing update error', errorMessage: 'Failed to update activity sharing' }
);
