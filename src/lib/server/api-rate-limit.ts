const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 500;
const RATE_LIMIT_PREFIX = 'freeappractice:ai-rate-limit:v1';

const ATOMIC_INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

type PrivateEnv = Record<string, string | undefined>;

interface RateLimitConfig {
	redisUrl: string;
	redisToken: string;
	windowMs: number;
	maxRequests: number;
}

interface RedisResult {
	result?: unknown;
	error?: string;
}

export interface RateLimitEvent {
	url: URL;
	locals: { userId?: string };
	getClientAddress: () => string;
}

function readPositiveInteger(value: string | undefined, fallback: number, name: string): number {
	if (value === undefined) return fallback;

	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}

	return parsed;
}

function getConfig(privateEnv: PrivateEnv): RateLimitConfig {
	const redisUrl = privateEnv.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
	const redisToken = privateEnv.UPSTASH_REDIS_REST_TOKEN;

	if (!redisUrl || !redisToken) {
		throw new Error(
			'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for AI API rate limiting'
		);
	}

	return {
		redisUrl,
		redisToken,
		windowMs: readPositiveInteger(
			privateEnv.API_RATE_LIMIT_WINDOW_MS,
			DEFAULT_WINDOW_MS,
			'API_RATE_LIMIT_WINDOW_MS'
		),
		maxRequests: readPositiveInteger(
			privateEnv.API_RATE_LIMIT_MAX,
			DEFAULT_MAX_REQUESTS,
			'API_RATE_LIMIT_MAX'
		)
	};
}

export function isRateLimitedAiPath(pathname: string): boolean {
	return pathname === '/api/question' || pathname.startsWith('/api/tutor/');
}

function errorResponse(message: string, status: number, retryAfter?: number): Response {
	const headers = new Headers({ 'Content-Type': 'application/json' });
	if (retryAfter !== undefined) headers.set('Retry-After', String(retryAfter));

	return new Response(JSON.stringify({ error: message }), { status, headers });
}

export async function enforceAiRateLimit(
	event: RateLimitEvent,
	options: {
		privateEnv: PrivateEnv;
		fetchImpl?: typeof fetch;
		onError?: (error: unknown) => void;
	}
): Promise<Response | null> {
	if (!isRateLimitedAiPath(event.url.pathname)) return null;

	try {
		const config = getConfig(options.privateEnv);
		const identity = event.locals.userId
			? `user:${event.locals.userId}`
			: `ip:${event.getClientAddress()}`;
		const key = `${RATE_LIMIT_PREFIX}:${identity}`;
		const fetchImpl = options.fetchImpl ?? fetch;
		const response = await fetchImpl(config.redisUrl, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.redisToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(['EVAL', ATOMIC_INCREMENT_SCRIPT, '1', key, String(config.windowMs)])
		});

		if (!response.ok) throw new Error(`Redis returned HTTP ${response.status}`);

		const payload = (await response.json()) as RedisResult;
		if (payload.error) throw new Error(`Redis command failed: ${payload.error}`);
		if (!Array.isArray(payload.result) || payload.result.length !== 2) {
			throw new Error('Redis returned an invalid rate-limit result');
		}

		const count = Number(payload.result[0]);
		const ttlMs = Number(payload.result[1]);
		if (!Number.isSafeInteger(count) || !Number.isFinite(ttlMs)) {
			throw new Error('Redis returned non-numeric rate-limit values');
		}

		if (count > config.maxRequests) {
			return errorResponse('Too many requests', 429, Math.max(1, Math.ceil(ttlMs / 1000)));
		}

		return null;
	} catch (error) {
		options.onError?.(error);
		return errorResponse('Service temporarily unavailable', 503);
	}
}
