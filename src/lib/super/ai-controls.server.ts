import { randomUUID } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { sql } from 'drizzle-orm';
import {
	getRedisClient,
	hashRedisIdentifier,
	redisNamespace,
	withRedisTimeout
} from '$lib/redis/server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { superUsageRollups } from '$lib/server/neon/schema';
import {
	monthlyCreditLimitMilli,
	SUPER_MONTHLY_CREDITS_MILLI
} from '$lib/super/usage-credits';
import type { SuperAccessReason } from '$lib/super/types';

const RATE_WINDOW = '10 m' as const;
const GENERIC_ANONYMOUS_LIMIT = 12;
const GENERIC_SIGNED_IN_LIMIT = 30;
const SUPER_AI_LIMIT = 60;
const COACH_LOCK_TTL_SECONDS = 75;
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

const CHARGE_USAGE_SCRIPT = `
local used = redis.call('INCRBY', KEYS[1], tonumber(ARGV[2]))
if used == tonumber(ARGV[2]) then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return used
`;

/** Monthly Coach usage in millicredits (1000 millicredits = 1 credit). */
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
	const limitMilli = usage.limit ?? SUPER_MONTHLY_CREDITS_MILLI;
	const percentage = (usage.used / limitMilli) * 100;
	if (percentage >= 95) return 95;
	if (percentage >= 80) return 80;
	return null;
}

export async function getPersonalizedUsage(
	userId: string,
	accessReason: SuperAccessReason,
	now = new Date()
): Promise<UsageReservation> {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	const month = currentUtcMonth(now);
	const limitCount = monthlyCreditLimitMilli(accessReason);
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

/** Adds millicredits after a billable Coach turn (soft overage allowed for the completing turn). */
export async function chargePersonalizedCredits(
	userId: string,
	month: string,
	millicredits: number,
	now = new Date()
): Promise<number> {
	if (millicredits <= 0) {
		const redis = getRedisClient();
		if (!redis) throw new RedisRequiredError();
		return Number(
			(await withRedisTimeout(redis.get<number>(usageKey(userId, month)), 750)) ?? 0
		);
	}
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	try {
		const used = Number(
			await withRedisTimeout(
				redis
					.createScript<number>(CHARGE_USAGE_SCRIPT)
					.exec(
						[usageKey(userId, month)],
						[String(secondsUntilUsageExpiry(now)), String(millicredits)]
					),
				750
			)
		);
		return used;
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
			creditsMilli: usage.used,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [superUsageRollups.userId, superUsageRollups.month],
			set: {
				creditsMilli: sql`GREATEST(${superUsageRollups.creditsMilli}, ${usage.used})`,
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
		`${namespace}:rate:super-ai:user:${userId}`
	];
	try {
		await withRedisTimeout(redis.del(...keys), 750);
	} catch {
		// Redis controls are intentionally non-durable; their explicit TTLs are the fallback cleanup.
	}
}
