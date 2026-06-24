import { dev } from '$app/environment';
import { resolve } from '$app/paths';
import { env as publicEnv } from '$env/dynamic/public';

export const PRODUCTION_SITE_URL = 'https://freeappractice.org';

/** Canonical site origin for sitemaps, emails, and structured data. */
export function getSiteUrl(requestOrigin?: string): string {
	const configured = publicEnv.PUBLIC_BASE_URL?.replace(/\/+$/, '');
	if (configured) return configured;
	if (dev) return (requestOrigin ?? 'http://localhost:5173').replace(/\/+$/, '');
	return PRODUCTION_SITE_URL;
}

type AuthCallbackPath =
	| '/app'
	| '/app/settings'
	| '/reset-password'
	| '/login'
	| '/signup'
	| '/email-sent';

/** Absolute callback URL for Better Auth (required for OAuth and email flows). */
export function authCallbackUrl(path: AuthCallbackPath): string {
	return `${getSiteUrl()}${resolve(path)}`;
}
