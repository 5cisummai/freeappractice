import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

type AuthedHandler = (event: RequestEvent, userId: string) => Promise<Response>;

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
