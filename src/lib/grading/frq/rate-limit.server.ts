import { Ratelimit } from '@upstash/ratelimit';
import { getRedisClient, redisNamespace, withRedisTimeout } from '#lib/redis/server.js';

const USER_WINDOW = '10 m' as const;
const USER_LIMIT = 8;
const QUESTION_WINDOW = '5 m' as const;
const QUESTION_LIMIT = 2;

export type FrqGradeRateLimitDecision = {
	allowed: boolean;
	retryAt: number | null;
	degraded: boolean;
};

/**
 * Cap expensive FRQ grading calls per user, with a short per-question cooldown
 * so new submissionIds cannot bypass the limit.
 */
export async function limitFrqGrading(
	userId: string,
	questionId: string
): Promise<FrqGradeRateLimitDecision> {
	try {
		const redis = getRedisClient();
		if (!redis) return { allowed: false, retryAt: null, degraded: true };

		const userLimiter = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(USER_LIMIT, USER_WINDOW),
			prefix: `${redisNamespace()}:rate:frq-grade:user`,
			analytics: false,
			timeout: 500
		});
		const userResult = await withRedisTimeout(userLimiter.limit(`user:${userId}`), 750);
		if (userResult.reason === 'timeout') {
			return { allowed: false, retryAt: null, degraded: true };
		}
		if (!userResult.success) {
			return { allowed: false, retryAt: userResult.reset, degraded: false };
		}

		const questionLimiter = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(QUESTION_LIMIT, QUESTION_WINDOW),
			prefix: `${redisNamespace()}:rate:frq-grade:question`,
			analytics: false,
			timeout: 500
		});
		const questionResult = await withRedisTimeout(
			questionLimiter.limit(`user:${userId}:q:${questionId}`),
			750
		);
		if (questionResult.reason === 'timeout') {
			return { allowed: false, retryAt: null, degraded: true };
		}
		return {
			allowed: questionResult.success,
			retryAt: questionResult.success ? null : questionResult.reset,
			degraded: false
		};
	} catch {
		return { allowed: false, retryAt: null, degraded: true };
	}
}

export function frqGradeRateLimitedResponse(retryAt: number | null): Response {
	return Response.json(
		{ error: 'Too many grading requests. Please try again shortly.', retryAt },
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
