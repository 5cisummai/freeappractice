import { Ratelimit } from '@upstash/ratelimit';
import {
	getRedisClient,
	hashRedisIdentifier,
	redisNamespace,
	withRedisTimeout
} from '$lib/redis/server';

const WINDOW = '10 m' as const;
const ANONYMOUS_LIMIT = 12;
const SIGNED_IN_LIMIT = 30;

export type SharedPracticeRateLimitDecision = {
	allowed: boolean;
	retryAt: number | null;
	degraded: boolean;
};

function clientIp(request: Request): string {
	return (
		request.headers.get('x-real-ip')?.trim() ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	);
}

export async function limitSharedPracticeSetCreation(
	request: Request,
	userId?: string
): Promise<SharedPracticeRateLimitDecision> {
	try {
		const redis = getRedisClient();
		if (!redis) return { allowed: true, retryAt: null, degraded: true };

		const limiter = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(userId ? SIGNED_IN_LIMIT : ANONYMOUS_LIMIT, WINDOW),
			prefix: `${redisNamespace()}:rate:shared-practice-set`,
			analytics: false,
			timeout: 500
		});
		const identifier = userId ? `user:${userId}` : `ip:${hashRedisIdentifier(clientIp(request))}`;
		const result = await withRedisTimeout(limiter.limit(identifier), 750);
		if (result.reason === 'timeout') return { allowed: true, retryAt: null, degraded: true };
		return {
			allowed: result.success,
			retryAt: result.success ? null : result.reset,
			degraded: false
		};
	} catch {
		return { allowed: true, retryAt: null, degraded: true };
	}
}
