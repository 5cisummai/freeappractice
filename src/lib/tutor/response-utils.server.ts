import { json } from '@sveltejs/kit';

export function tutorRateLimitedResponse(retryAt: number | null): Response {
	return json(
		{ error: 'Too many tutor requests. Please try again shortly.', retryAt },
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
