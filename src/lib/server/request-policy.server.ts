import { matchesPublicMarketingPath } from '$lib/routes/public-marketing.server';

/** Hot anonymous MCQ pool fetch — skips session lookup and global Redis rate limiting. */
export function isAnonymousMcqFetch(method: string, pathname: string): boolean {
	return method === 'POST' && pathname === '/api/question';
}

export function shouldSkipSessionLookup(method: string, pathname: string): boolean {
	if (isAnonymousMcqFetch(method, pathname)) return true;
	return method === 'GET' && matchesPublicMarketingPath(pathname);
}

export function shouldSkipGlobalApiRateLimit(method: string, pathname: string): boolean {
	return isAnonymousMcqFetch(method, pathname);
}
