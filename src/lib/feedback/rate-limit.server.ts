import { Ratelimit } from '@upstash/ratelimit';
import {
	getRedisClient,
	hashRedisIdentifier,
	redisNamespace,
	withRedisTimeout
} from '$lib/redis/server';

export type FeedbackRateLimitDecision = {
	allowed: boolean;
	retryAt: number | null;
	degraded: boolean;
};

/** Limit app feedback submissions across all serverless instances. */
export async function limitFeedback(clientIp: string): Promise<FeedbackRateLimitDecision> {
	try {
		const redis = getRedisClient();
		if (!redis) return { allowed: true, retryAt: null, degraded: true };

		const limiter = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(3, '10 m'),
			prefix: `${redisNamespace()}:rate:app-feedback`,
			analytics: false,
			timeout: 500
		});
		const result = await withRedisTimeout(limiter.limit(hashRedisIdentifier(clientIp)), 750);
		if (result.reason === 'timeout') {
			return { allowed: true, retryAt: null, degraded: true };
		}
		return {
			allowed: result.success,
			retryAt: result.success ? null : result.reset,
			degraded: false
		};
	} catch {
		return { allowed: true, retryAt: null, degraded: true };
	}
}
