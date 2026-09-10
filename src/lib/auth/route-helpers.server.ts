import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/auth/server';
import { logger } from '$lib/server/logger';

type AuthedHandler = (event: RequestEvent, userId: string) => Promise<Response>;

/** Reuse the hook's session result and retry only when the hook skipped or failed its lookup. */
export async function getOptionalUserId(event: RequestEvent): Promise<string | undefined> {
	if (event.locals.userId) return event.locals.userId;
	if (event.locals.sessionResolved) return undefined;

	const session = await auth.api.getSession({ headers: event.request.headers });
	event.locals.sessionResolved = true;
	if (!session?.user?.id) return undefined;
	event.locals.session = session.session;
	event.locals.user = session.user;
	event.locals.userId = session.user.id;
	return session.user.id;
}

/**
 * Full auth guard for use in +server.ts handlers.
 * Uses Better Auth session cookies; falls back to locals when already populated by hooks.
 */
async function requireAuth(event: RequestEvent): Promise<string> {
	const userId = await getOptionalUserId(event);
	if (userId) return userId;

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
