import { z } from 'zod';
import { auth } from '#lib/auth/server.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';

const inputSchema = z.object({ invitationId: z.string().trim().min(1) }).strict();

export const DELETE = withAuthedHandler(
	async (event) => {
		const parsed = inputSchema.safeParse(await event.request.json().catch(() => null));
		if (!parsed.success)
			return Response.json({ error: 'A valid invitationId is required.' }, { status: 400 });
		await auth.api.cancelInvitation({
			body: { invitationId: parsed.data.invitationId },
			headers: event.request.headers
		});
		return Response.json({ cancelled: true });
	},
	{
		logLabel: 'Organization invitation cancellation error',
		errorMessage: 'Failed to cancel invitation'
	}
);
