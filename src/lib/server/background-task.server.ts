import { waitUntil } from '@vercel/functions';

/** Schedule non-critical work after the response when running on Vercel. */
export function scheduleBackgroundTask(task: Promise<unknown>): void {
	try {
		waitUntil(task);
	} catch {
		// Local scripts and tests do not have a Vercel request context.
		void task;
	}
}
