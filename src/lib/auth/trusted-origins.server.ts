import { dev } from '$app/env';
import { PUBLIC_BASE_URL } from '$app/env/public';
import {
	APP_BASE_URL,
	WEBSITE_URL,
	BETTER_AUTH_URL,
	VERCEL_URL,
	VERCEL_BRANCH_URL,
	VERCEL_PROJECT_PRODUCTION_URL
} from '$app/env/private';

const PRODUCTION_ORIGINS = ['https://freeappractice.org', 'https://www.freeappractice.org'];

function toOrigin(value: string | undefined): string | null {
	if (!value) return null;

	try {
		const normalized = value.includes('://') ? value : `https://${value}`;
		return new URL(normalized).origin;
	} catch {
		return null;
	}
}

function collectOriginsFromEnv(): Set<string> {
	const origins = new Set<string>(PRODUCTION_ORIGINS);

	for (const value of [
		PUBLIC_BASE_URL,
		APP_BASE_URL,
		WEBSITE_URL,
		BETTER_AUTH_URL,
		VERCEL_URL ? `https://${VERCEL_URL}` : undefined,
		VERCEL_BRANCH_URL ? `https://${VERCEL_BRANCH_URL}` : undefined,
		VERCEL_PROJECT_PRODUCTION_URL ? `https://${VERCEL_PROJECT_PRODUCTION_URL}` : undefined
	]) {
		const origin = toOrigin(value);
		if (origin) origins.add(origin);
	}

	if (dev) {
		for (const origin of [
			'http://localhost:5173',
			'http://localhost:4173',
			'http://localhost:3000',
			'http://127.0.0.1:5173',
			'http://127.0.0.1:4173',
			'http://127.0.0.1:3000'
		]) {
			origins.add(origin);
		}
	}

	return origins;
}

/** Allowed browser origins for CORS on API routes. */
export function getAllowedOrigins(): Set<string> {
	return collectOriginsFromEnv();
}

/** Build Better Auth trustedOrigins from env (localhost only in dev). */
export function getTrustedOrigins(): string[] {
	return [...getAllowedOrigins()];
}
