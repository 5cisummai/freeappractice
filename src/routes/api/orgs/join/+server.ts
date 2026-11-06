import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { isShareToken } from '#lib/auth/organization-types.js';
import { joinOrganization } from '#lib/auth/join-organization.server.js';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const body = (await event.request.json().catch(() => null)) as { token?: unknown } | null;
		const token = typeof body?.token === 'string' ? body.token.trim() : '';
		if (!isShareToken(token)) {
			return Response.json({ error: 'That invite link is invalid.' }, { status: 400 });
		}
		const result = await joinOrganization(token, userId, event.request.headers);
		if ('error' in result) return Response.json({ error: result.error }, { status: 404 });
		return Response.json(result);
	},
	{ logLabel: 'org join', errorMessage: 'Could not join that organization.' }
);
