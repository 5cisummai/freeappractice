import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { resolveSharedQuizForUser } from '#lib/shared-practice/shared-sets.server.js';

export const GET = withAuthedHandler(
	async (event, userId) => {
		const slug = event.params.slug?.trim();
		if (!slug) return Response.json({ error: 'Shared quiz is required.' }, { status: 400 });
		const result = await resolveSharedQuizForUser(
			slug,
			userId,
			event.locals.session?.activeOrganizationId ?? null
		);
		return Response.json(result, { status: result.status === 'ready' ? 200 : 404 });
	},
	{ logLabel: 'Resolve shared quiz error', errorMessage: 'Failed to load shared quiz' }
);
