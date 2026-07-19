import { getSiteUrl } from '$lib/site-url';

export function absoluteUrl(path: string, requestUrl?: URL): string {
	const origin = getSiteUrl(requestUrl?.origin);
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${origin}${normalized}`;
}
