import type { RequestEvent } from '@sveltejs/kit';
import { auth } from '$lib/auth/server';

/**
 * Full auth guard for use in +server.ts handlers.
 * Uses Better Auth session cookies; falls back to locals when already populated by hooks.
 */
export async function requireAuth(event: RequestEvent): Promise<string> {
	if (event.locals.userId) {
		return event.locals.userId;
	}

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (session?.user?.id) {
		event.locals.session = session.session;
		event.locals.user = session.user;
		event.locals.userId = session.user.id;
		return session.user.id;
	}

	throw new Response(JSON.stringify({ error: 'Authentication required' }), {
		status: 401,
		headers: { 'Content-Type': 'application/json' }
	});
}
