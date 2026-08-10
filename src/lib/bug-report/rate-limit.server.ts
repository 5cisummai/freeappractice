import { Ratelimit } from '@upstash/ratelimit';
import {
	getRedisClient,
	hashRedisIdentifier,
	redisNamespace,
	withRedisTimeout
} from '$lib/redis/server';

export type BugReportRateLimitDecision = {
	allowed: boolean;
	retryAt: number | null;
	degraded: boolean;
};

/** Limit bug reports across all serverless instances without storing raw IP addresses. */
export async function limitBugReports(clientIp: string): Promise<BugReportRateLimitDecision> {
	try {
		const redis = getRedisClient();
		if (!redis) return { allowed: true, retryAt: null, degraded: true };

		const limiter = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(1, '1 m'),
			prefix: `${redisNamespace()}:rate:bug-report`,
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
