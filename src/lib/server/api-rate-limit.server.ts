import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
import { enforceAiRateLimit } from './api-rate-limit';

export type { RateLimitEvent } from './api-rate-limit';

export function enforceConfiguredAiRateLimit(
	event: Parameters<typeof enforceAiRateLimit>[0]
): Promise<Response | null> {
	return enforceAiRateLimit(event, {
		privateEnv: env,
		onError: (error) =>
			logger.error('AI API rate limiter unavailable', { error, path: event.url.pathname })
	});
}
