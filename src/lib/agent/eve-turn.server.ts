import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { agentContextSchema } from '#lib/agent/request.js';
import { getRedisClient, redisNamespace, withRedisTimeout } from '#lib/redis/server.js';
import { RedisRequiredError } from '#lib/agent/usage/controls.server.js';

const claimsSchema = z.strictObject({
	iss: z.literal('freeappractice'),
	aud: z.literal('coach-tools/v1'),
	sub: z.string().min(1),
	jti: z.uuid(),
	exp: z.number().int(),
	sessionId: z.uuid(),
	accessReason: z.enum(['subscription', 'past_due_grace', 'admin_grant', 'free_beta']).nullable(),
	conversationId: z.uuid(),
	context: agentContextSchema,
	scopes: z.array(z.string())
});

export type EveTurnClaims = z.infer<typeof claimsSchema>;
const jwtHeader = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
const ttlSeconds = 120;

function secret(name: string): string {
	const value = process.env[name];
	if (!value || value.length < 32) throw new Error(`Missing Coach configuration: ${name}`);
	return value;
}

function equal(left: string, right: string): boolean {
	const a = Buffer.from(left);
	const b = Buffer.from(right);
	return a.length === b.length && timingSafeEqual(a, b);
}

function signature(data: string): string {
	return createHmac('sha256', secret('COACH_EVE_TURN_SECRET')).update(data).digest('base64url');
}

export function eveServiceSecret(): string {
	return secret('COACH_EVE_SERVICE_SECRET');
}

export function isEveServiceRequest(request: Request): boolean {
	try {
		return equal(request.headers.get('authorization') ?? '', `Bearer ${eveServiceSecret()}`);
	} catch {
		return false;
	}
}

function turnKey(turnId: string) {
	return `${redisNamespace()}:coach:eve:v1:${turnId}`;
}

function redisClient() {
	const redis = getRedisClient();
	if (!redis) throw new RedisRequiredError();
	return redis;
}

export async function openEveTurn(
	input: Omit<EveTurnClaims, 'iss' | 'aud' | 'jti' | 'exp'>
): Promise<string> {
	const jti = randomUUID();
	const claims = claimsSchema.parse({
		...input,
		iss: 'freeappractice',
		aud: 'coach-tools/v1',
		jti,
		exp: Math.floor(Date.now() / 1000) + ttlSeconds
	});
	const value = `${jwtHeader}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
	await withRedisTimeout(
		redisClient().set(turnKey(jti), `${value}.${signature(value)}`, { ex: ttlSeconds }),
		750
	);
	return jti;
}

export async function getEveTurn(turnId: string): Promise<EveTurnClaims | null> {
	const jwt = await withRedisTimeout(redisClient().get<string>(turnKey(turnId)), 750);
	if (typeof jwt !== 'string') return null;
	const [header, payload, mac, extra] = jwt.split('.');
	if (header !== jwtHeader || !payload || !mac || extra !== undefined) return null;
	if (!equal(mac, signature(`${header}.${payload}`))) return null;
	try {
		const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
		return claims.jti === turnId && claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
	} catch {
		return null;
	}
}

export async function closeEveTurn(turnId: string): Promise<void> {
	await withRedisTimeout(redisClient().del(turnKey(turnId)), 750);
}

export async function getEveToolRecord<T>(turnId: string, key: string): Promise<T | null> {
	return withRedisTimeout(redisClient().get<T>(`${turnKey(turnId)}:${key}`), 750);
}

export async function setEveToolRecord(turnId: string, key: string, value: unknown): Promise<void> {
	await withRedisTimeout(
		redisClient().set(`${turnKey(turnId)}:${key}`, value, { ex: ttlSeconds }),
		750
	);
}

const searchUsageScript = `
	local current = redis.call('HGET', KEYS[1], ARGV[1])
	if ARGV[2] == 'complete' then
		if not current then return 0 end
		redis.call('HSET', KEYS[1], ARGV[1], 'complete')
		return 1
	end
	if current or redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
	redis.call('HSET', KEYS[1], ARGV[1], 'pending')
	redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
	return 1
`;

export async function recordEveSearch(
	turnId: string,
	callId: string,
	phase: 'authorize' | 'complete',
	maxSearches = 0
): Promise<boolean> {
	const result = await withRedisTimeout(
		redisClient().eval<unknown[], number>(
			searchUsageScript,
			[`${turnKey(turnId)}:searches`],
			[callId, phase, maxSearches, ttlSeconds]
		),
		750
	);
	return result === 1;
}

export async function getEveSearchCount(turnId: string): Promise<number> {
	const records: unknown[] = await withRedisTimeout(
		redisClient().hvals(`${turnKey(turnId)}:searches`),
		750
	);
	return records.filter((value) => value === 'complete').length;
}

export async function claimEveToolCall(turnId: string, key: string): Promise<boolean> {
	return (
		(await withRedisTimeout(
			redisClient().set(`${turnKey(turnId)}:${key}`, '1', { ex: ttlSeconds, nx: true }),
			750
		)) === 'OK'
	);
}
