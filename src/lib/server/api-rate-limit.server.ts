import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';
import {
	getRedisClient,
	hashRedisIdentifier,
	redisNamespace,
	withRedisTimeout
} from '$lib/redis/server';

const WINDOW = '1 s' as const;
const ANONYMOUS_LIMIT = 10;
const AUTHENTICATED_LIMIT = 20;

export type ApiRateLimitDecision = {
	allowed: boolean;
	retryAt: number | null;
	limit: number;
	degraded: boolean;
};

// Separate prefixes for anon vs authed limiters (required once limits diverged).
// Deploying this resets prior `api-global` counters in Redis.
let anonymousLimiter: Ratelimit | undefined;
let authenticatedLimiter: Ratelimit | undefined;

function clientIp(request: Request): string {
	return (
		request.headers.get('x-real-ip')?.trim() ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	);
}

function limiterForUser(redis: Redis, userId?: string): Ratelimit {
	if (userId) {
		authenticatedLimiter ??= new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(AUTHENTICATED_LIMIT, WINDOW),
			prefix: `${redisNamespace()}:rate:api-global:auth`,
			analytics: false,
			timeout: 500
		});
		return authenticatedLimiter;
	}

	anonymousLimiter ??= new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(ANONYMOUS_LIMIT, WINDOW),
		prefix: `${redisNamespace()}:rate:api-global:anon`,
		analytics: false,
		timeout: 500
	});
	return anonymousLimiter;
}

/** Global API backstop. Endpoint-specific limits remain responsible for sensitive operations. */
export async function limitApiRequests(
	request: Request,
	userId?: string
): Promise<ApiRateLimitDecision> {
	const limit = userId ? AUTHENTICATED_LIMIT : ANONYMOUS_LIMIT;

	try {
		const redis = getRedisClient();
		if (!redis) return { allowed: true, retryAt: null, limit, degraded: true };

		const limiter = limiterForUser(redis, userId);
		const identifier = userId ? `user:${userId}` : `ip:${hashRedisIdentifier(clientIp(request))}`;
		const result = await withRedisTimeout(limiter.limit(identifier), 750);
		if (result.reason === 'timeout') {
			return { allowed: true, retryAt: null, limit, degraded: true };
		}

		return {
			allowed: result.success,
			retryAt: result.success ? null : result.reset,
			limit,
			degraded: false
		};
	} catch {
		return { allowed: true, retryAt: null, limit, degraded: true };
	}
}
