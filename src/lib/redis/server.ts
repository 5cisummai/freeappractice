import { createHmac } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

let redisClient: Redis | null | undefined;

export function getRedisClient(): Redis | null {
	if (redisClient !== undefined) return redisClient;
	const url = env.KV_REST_API_URL?.trim();
	const token = env.KV_REST_API_TOKEN?.trim();
	redisClient = url && token ? new Redis({ url, token }) : null;
	return redisClient;
}

export function resetRedisClientForTests(): void {
	redisClient = undefined;
}

export function redisNamespace(): string {
	const vercelEnvironment = env.VERCEL_ENV;
	const environment =
		vercelEnvironment === 'production'
			? 'prod'
			: vercelEnvironment === 'preview'
				? 'preview'
				: 'dev';
	return `fap:${environment}`;
}

export function hashRedisIdentifier(value: string): string {
	const secret = env.REDIS_IDENTIFIER_SECRET?.trim();
	if (!secret) throw new Error('REDIS_IDENTIFIER_SECRET is not set');
	return createHmac('sha256', secret).update(value).digest('base64url');
}

export async function withRedisTimeout<T>(promise: Promise<T>, timeoutMs = 750): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error('Redis request timed out')), timeoutMs);
			})
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}
