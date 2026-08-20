import { randomUUID } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { sql } from 'drizzle-orm';
import {
	getRedisClient,
	hashRedisIdentifier,
	redisNamespace,
	withRedisTimeout
} from '$lib/redis/server';
import { isSuperFreeBetaEnabled } from '$lib/flags';
import { getNeonDatabase } from '$lib/server/neon/db';
import { superUsageRollups } from '$lib/server/neon/schema';
import {
	SUPER_FREE_BETA_MONTHLY_MESSAGE_LIMIT,
	SUPER_MONTHLY_MESSAGE_LIMIT
} from '$lib/super/types';

const RATE_WINDOW = '10 m' as const;
const GENERIC_ANONYMOUS_LIMIT = 12;
const GENERIC_SIGNED_IN_LIMIT = 30;
const SUPER_AI_LIMIT = 60;
const COACH_LOCK_TTL_SECONDS = 75;
const INSIGHT_LOCK_TTL_SECONDS = 5 * 60;
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export class RedisRequiredError extends Error {
	constructor(message = 'This Super feature is temporarily unavailable') {
		super(message);
		this.name = 'RedisRequiredError';
	}
}

export type RateLimitDecision = {
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

function createSlidingWindowLimiter(limit: number, scope: string): Ratelimit {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	return new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(limit, RATE_WINDOW),
		prefix: `${redisNamespace()}:rate:${scope}`,
		analytics: false,
		timeout: 500
	});
}

async function limit(
	limitCount: number,
	scope: string,
	identifier: string,
	failOpen: boolean
): Promise<RateLimitDecision> {
	try {
		const result = await withRedisTimeout(
			createSlidingWindowLimiter(limitCount, scope).limit(identifier),
			750
		);
		if (result.reason === 'timeout') {
			if (failOpen) return { allowed: true, retryAt: null, degraded: true };
			throw new RedisRequiredError();
		}
		return {
			allowed: result.success,
			retryAt: result.success ? null : result.reset,
			degraded: false
		};
	} catch (error) {
		if (failOpen) return { allowed: true, retryAt: null, degraded: true };
		if (error instanceof RedisRequiredError) throw error;
		throw new RedisRequiredError();
	}
}

/** Existing Free tutor traffic keeps working if Redis is unavailable. */
export async function limitGenericTutor(
	request: Request,
	userId?: string
): Promise<RateLimitDecision> {
	try {
		const identifier = userId ? `user:${userId}` : `ip:${hashRedisIdentifier(clientIp(request))}`;
		return await limit(
			userId ? GENERIC_SIGNED_IN_LIMIT : GENERIC_ANONYMOUS_LIMIT,
			'tutor',
			identifier,
			true
		);
	} catch {
		return { allowed: true, retryAt: null, degraded: true };
	}
}

/** Personalized tutor and Coach remain fail-closed when Redis is unavailable. */
/** One combined 60-request window covers personalized tutoring and Coach. */
export async function limitSuperAi(userId: string): Promise<RateLimitDecision> {
	return limit(SUPER_AI_LIMIT, 'super-ai', `user:${userId}`, false);
}

export async function getSuperMonthlyMessageLimit(): Promise<number> {
	return (await isSuperFreeBetaEnabled())
		? SUPER_FREE_BETA_MONTHLY_MESSAGE_LIMIT
		: SUPER_MONTHLY_MESSAGE_LIMIT;
}

function currentUtcMonth(now = new Date()): string {
	return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function previousUtcMonth(now = new Date()): string {
	return currentUtcMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

function secondsUntilUsageExpiry(now = new Date()): number {
	const expiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 8));
	return Math.max(60, Math.ceil((expiry.getTime() - now.getTime()) / 1000));
}

function usageKey(userId: string, month: string): string {
	return `${redisNamespace()}:usage:${month}:${userId}`;
}

const RESERVE_USAGE_SCRIPT = `
local used = redis.call('INCR', KEYS[1])
if used == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2])) end
if used > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return {0, used - 1}
end
return {1, used}
`;

const RELEASE_USAGE_SCRIPT = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used <= 1 then
  redis.call('DEL', KEYS[1])
  return 0
end
return redis.call('DECR', KEYS[1])
`;

export type UsageReservation = {
	month: string;
	used: number;
	limit: number;
	remaining: number;
};

export type PersonalizedUsageWarning = 80 | 95 | null;

/** Warn once at 80% and again at 95%; the caller decides how to present the warning. */
export function getPersonalizedUsageWarning(
	usage: Pick<UsageReservation, 'used'> & Partial<Pick<UsageReservation, 'limit'>>
): PersonalizedUsageWarning {
	const percentage = (usage.used / (usage.limit ?? SUPER_MONTHLY_MESSAGE_LIMIT)) * 100;
	if (percentage >= 95) return 95;
	if (percentage >= 80) return 80;
	return null;
}

/** Atomically reserves one personalized turn before a model call. */
export async function reservePersonalizedTurn(
	userId: string,
	now = new Date()
): Promise<UsageReservation | null> {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	const month = currentUtcMonth(now);
	const limitCount = await getSuperMonthlyMessageLimit();
	try {
		const result = await withRedisTimeout(
			redis
				.createScript<number[]>(RESERVE_USAGE_SCRIPT)
				.exec(
					[usageKey(userId, month)],
					[String(limitCount), String(secondsUntilUsageExpiry(now))]
				),
			750
		);
		const allowed = Number(result[0]) === 1;
		const used = Number(result[1]);
		if (!allowed) return null;
		return { month, used, limit: limitCount, remaining: Math.max(0, limitCount - used) };
	} catch (error) {
		if (error instanceof RedisRequiredError) throw error;
		throw new RedisRequiredError();
	}
}

/** Only call when the model failed before producing useful output. */
export async function releasePersonalizedTurn(userId: string, month: string): Promise<void> {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	try {
		await withRedisTimeout(
			redis.createScript<number>(RELEASE_USAGE_SCRIPT).exec([usageKey(userId, month)], []),
			750
		);
	} catch (error) {
		if (error instanceof RedisRequiredError) throw error;
		throw new RedisRequiredError();
	}
}

export async function getPersonalizedUsage(
	userId: string,
	now = new Date()
): Promise<UsageReservation> {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	const month = currentUtcMonth(now);
	const limitCount = await getSuperMonthlyMessageLimit();
	try {
		const used = Number(
			(await withRedisTimeout(redis.get<number>(usageKey(userId, month)), 750)) ?? 0
		);
		return { month, used, limit: limitCount, remaining: Math.max(0, limitCount - used) };
	} catch (error) {
		if (error instanceof RedisRequiredError) throw error;
		throw new RedisRequiredError();
	}
}

/** Best-effort admin reporting; Redis remains the hot-path source. */
export async function rollupPersonalizedUsage(
	userId: string,
	usage: UsageReservation
): Promise<void> {
	const now = new Date();
	await getNeonDatabase()
		.insert(superUsageRollups)
		.values({
			userId,
			month: usage.month,
			personalizedMessages: usage.used,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [superUsageRollups.userId, superUsageRollups.month],
			set: {
				personalizedMessages: sql`GREATEST(${superUsageRollups.personalizedMessages}, ${usage.used})`,
				updatedAt: now
			}
		});
}

const COMPARE_AND_DELETE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

const REFRESH_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return 0
`;

export type LockHandle = { key: string; token: string };

async function acquireLock(key: string, ttlSeconds: number): Promise<LockHandle | null> {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	const token = randomUUID();
	try {
		const set = await withRedisTimeout(redis.set(key, token, { nx: true, ex: ttlSeconds }), 750);
		return set ? { key, token } : null;
	} catch {
		throw new RedisRequiredError();
	}
}

export async function releaseLock(lock: LockHandle): Promise<void> {
	const redis = getRedisClient();
	if (!redis) return;
	try {
		await withRedisTimeout(
			redis.createScript<number>(COMPARE_AND_DELETE_SCRIPT).exec([lock.key], [lock.token]),
			750
		);
	} catch {
		// Locks are disposable; their TTL is the fallback cleanup mechanism.
	}
}

/** Extends an owned lock while a streamed AI request is still in progress. */
export async function refreshLock(
	lock: LockHandle,
	ttlSeconds = COACH_LOCK_TTL_SECONDS
): Promise<boolean> {
	const redis = getRedisClient();
	if (!redis) return false;
	try {
		const refreshed = await withRedisTimeout(
			redis
				.createScript<number>(REFRESH_LOCK_SCRIPT)
				.exec([lock.key], [lock.token, String(ttlSeconds)]),
			750
		);
		return Number(refreshed) === 1;
	} catch {
		return false;
	}
}

export function acquireCoachLock(userId: string): Promise<LockHandle | null> {
	return acquireLock(`${redisNamespace()}:lock:coach:${userId}`, COACH_LOCK_TTL_SECONDS);
}

export function acquireInsightLock(userId: string): Promise<LockHandle | null> {
	return acquireLock(`${redisNamespace()}:lock:insights:${userId}`, INSIGHT_LOCK_TTL_SECONDS);
}

function idempotencyKey(userId: string, operationId: string): string {
	return `${redisNamespace()}:idempotency:${userId}:${operationId}`;
}

export async function claimIdempotencyKey(userId: string, operationId: string): Promise<boolean> {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	try {
		const result = await withRedisTimeout(
			redis.set(idempotencyKey(userId, operationId), '1', {
				nx: true,
				ex: IDEMPOTENCY_TTL_SECONDS
			}),
			750
		);
		return Boolean(result);
	} catch {
		throw new RedisRequiredError();
	}
}

/** Release a reservation only when the mutation did not reach durable storage. */
export async function releaseIdempotencyKey(userId: string, operationId: string): Promise<void> {
	const redis = getRedisClient();
	if (!redis) return;
	try {
		await withRedisTimeout(redis.del(idempotencyKey(userId, operationId)), 750);
	} catch {
		// The key's explicit TTL is the fallback if Redis cannot be reached.
	}
}

/**
 * Best-effort removal of the user-scoped Redis controls whose keys are known without scanning.
 * Session authorization and idempotency keys remain disposable and expire on their own TTLs.
 */
export async function purgeKnownRedisControlsForUser(
	userId: string,
	now = new Date()
): Promise<void> {
	const redis = getRedisClient();
	if (!redis) return;
	const namespace = redisNamespace();
	const keys = [
		usageKey(userId, currentUtcMonth(now)),
		usageKey(userId, previousUtcMonth(now)),
		`${namespace}:lock:coach:${userId}`,
		`${namespace}:lock:insights:${userId}`,
		`${namespace}:rate:super-ai:user:${userId}`
	];
	try {
		await withRedisTimeout(redis.del(...keys), 750);
	} catch {
		// Redis controls are intentionally non-durable; their explicit TTLs are the fallback cleanup.
	}
}
