import { Ratelimit } from '@upstash/ratelimit';
import {
	getRedisClient,
	hashRedisIdentifier,
	redisNamespace,
	withRedisTimeout
} from '$lib/redis/server';

/** The same standard Tutor limit applies to all signed-in users, regardless of plan. */
export async function limitGenericTutor(request: Request, userId?: string) {
	try {
		const redis = getRedisClient();
		if (!redis) throw new Error('Redis unavailable');
		const ip =
			request.headers.get('x-real-ip')?.trim() ||
			request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
			'unknown';
		const identifier = userId ? `user:${userId}` : `ip:${hashRedisIdentifier(ip)}`;
		const limiter = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(userId ? 30 : 12, '10 m'),
			prefix: `${redisNamespace()}:rate:tutor`,
			analytics: false,
			timeout: 500
		});
		const result = await withRedisTimeout(limiter.limit(identifier), 750);
		if (result.reason === 'timeout') throw new Error('Redis timeout');
		return {
			allowed: result.success,
			retryAt: result.success ? null : result.reset,
			degraded: false
		};
	} catch {
		return { allowed: true, retryAt: null, degraded: true };
	}
}
