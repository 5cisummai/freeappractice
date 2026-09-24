import { waitUntil } from '@vercel/functions';
import { logger } from '$lib/server/logger';

/** Schedule non-critical work after the response when running on Vercel. */
export function scheduleBackgroundTask(task: Promise<unknown>): void {
	try {
		waitUntil(task);
	} catch {
		// Local scripts and tests do not have a Vercel request context.
		void task.catch((error) => logger.warn('Background task failed', { error }));
	}
}
