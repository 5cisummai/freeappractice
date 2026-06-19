import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

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
		env.PUBLIC_BASE_URL,
		env.APP_BASE_URL,
		env.WEBSITE_URL,
		env.BETTER_AUTH_URL,
		env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
		env.VERCEL_BRANCH_URL ? `https://${env.VERCEL_BRANCH_URL}` : undefined,
		env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined
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

/** Build Better Auth trustedOrigins from env (localhost only in dev). */
export function getTrustedOrigins(): string[] {
	return [...collectOriginsFromEnv()];
}

/** Allowed browser origins for CORS on API routes. */
export function getAllowedOrigins(): Set<string> {
	return collectOriginsFromEnv();
}
