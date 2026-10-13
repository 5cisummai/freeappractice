import { createHmac } from 'node:crypto';
import { Redis } from '@upstash/redis';

import {
	KV_REST_API_URL,
	KV_REST_API_TOKEN,
	VERCEL_ENV,
	REDIS_IDENTIFIER_SECRET
} from '$app/env/private';

let redisClient: Redis | null | undefined;

export function getRedisClient(): Redis | null {
	if (redisClient !== undefined) return redisClient;

	const url = KV_REST_API_URL?.trim();
	const token = KV_REST_API_TOKEN?.trim();

	redisClient =
		url && token
			? new Redis({
					url,
					token,
					// Abort the transport as well as bounding callers with withRedisTimeout.
					// A fresh signal is required for each request on this shared client.
					signal: () => AbortSignal.timeout(750),
					retry: false
				})
			: null;
	return redisClient;
}

export function redisNamespace(): string {
	const vercelEnvironment = VERCEL_ENV;

	const environment =
		vercelEnvironment === 'production'
			? 'prod'
			: vercelEnvironment === 'preview'
				? 'preview'
				: 'dev';
	return `fap:${environment}`;
}

export function hashRedisIdentifier(value: string): string {
	const secret = REDIS_IDENTIFIER_SECRET?.trim();
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
