import { resolve } from '$app/paths';
import { getSiteUrl } from '$lib/site-url';
import { safeAppPath } from '$lib/auth/app-path';

export { safeAppPath };

type AuthCallbackPath =
	'/app' | '/app/settings' | '/reset-password' | '/login' | '/signup' | '/email-sent';

/** Absolute callback URL for Better Auth (required for OAuth and email flows). */
export function authCallbackUrl(path: AuthCallbackPath): string {
	return `${getSiteUrl()}${resolve(path)}`;
}

export function authCallbackUrlForAppPath(path: string | null | undefined): string {
	return `${getSiteUrl()}${safeAppPath(path)}`;
}
