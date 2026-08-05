import { waitUntil } from '@vercel/functions';
import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

export function tutorRateLimitedResponse(retryAt: number | null): Response {
	return json(
		{ error: 'Too many tutor requests. Please try again shortly.' },
		retryAt
			? {
					status: 429,
					headers: {
						'Retry-After': String(Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)))
					}
				}
			: { status: 429 }
	);
}

export function scheduleTutorMemoryWrite(work: Promise<unknown>, surface: 'MCQ' | 'FRQ'): void {
	const safeWork = work.catch((error) =>
		logger.warn(`${surface} tutor memory update failed`, { error })
	);
	try {
		waitUntil(safeWork);
	} catch {
		void safeWork;
	}
}
