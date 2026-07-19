import { dev } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

export const PRODUCTION_SITE_URL = 'https://freeappractice.org';

/** Canonical site origin for sitemaps, emails, and structured data. */
export function getSiteUrl(requestOrigin?: string): string {
	const configured = publicEnv.PUBLIC_BASE_URL?.replace(/\/+$/, '');
	if (configured) return configured;
	if (dev) return (requestOrigin ?? 'http://localhost:5173').replace(/\/+$/, '');
	return PRODUCTION_SITE_URL;
}
