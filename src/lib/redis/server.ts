import { createHmac } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { dev } from '$app/env';

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
	// The local HTTP proxy uses standard Redis, which does not support Upstash's
	// script flag. Keep the same Lua rate limiter and remove only that flag locally.
	if (
		dev &&
		redisClient &&
		url &&
		['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(url).hostname)
	) {
		redisClient = new Proxy(redisClient, {
			get(target, property, receiver) {
				if (property === 'eval') {
					return (script: string, keys: string[], args: unknown[]) =>
						target.eval(script.replace(/^#!lua flags=allow-key-locking\r?\n/, ''), keys, args);
				}
				return Reflect.get(target, property, receiver);
			}
		});
	}
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
