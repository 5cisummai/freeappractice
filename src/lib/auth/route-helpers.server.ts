import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/auth/server';
import { logger } from '$lib/server/logger';

type AuthedHandler = (event: RequestEvent, userId: string) => Promise<Response>;

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

/**
 * Wraps an authenticated API handler: requireAuth → handler → catch Response rethrow + 500 log.
 */
export function withAuthedHandler(
	handler: AuthedHandler,
	options: { logLabel: string; errorMessage: string }
): RequestHandler {
	return async (event) => {
		try {
			const userId = await requireAuth(event);
			return await handler(event, userId);
		} catch (err) {
			if (err instanceof Response) return err;
			logger.error(options.logLabel, { error: err });
			return json({ error: options.errorMessage }, { status: 500 });
		}
	};
}
