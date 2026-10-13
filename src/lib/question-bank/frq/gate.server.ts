import { isFrqPracticeEnabled } from '#lib/flags.js';

const FRQ_UNAVAILABLE_MESSAGE = 'Written-response practice is unavailable';

/** Returns a 404 Response when FRQ practice is disabled; null when enabled. */
export async function requireFrqPracticeEnabled(): Promise<Response | null> {
	if (await isFrqPracticeEnabled()) return null;
	return Response.json({ error: FRQ_UNAVAILABLE_MESSAGE }, { status: 404 });
}
