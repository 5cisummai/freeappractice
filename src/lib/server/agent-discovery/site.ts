import { getSiteUrl } from '$lib/auth/urls';

/** Canonical origin for agent discovery documents (no trailing slash). */
export function getAgentDiscoveryOrigin(requestUrl?: URL): string {
	return getSiteUrl(requestUrl?.origin);
}

export function absoluteUrl(path: string, requestUrl?: URL): string {
	const origin = getAgentDiscoveryOrigin(requestUrl);
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${origin}${normalized}`;
}
