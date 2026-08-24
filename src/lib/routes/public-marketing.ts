function matchesPathPrefix(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Marketing pages that skip session lookup on GET. */
const PUBLIC_READ_EXACT = new Set([
	'/',
	'/about',
	'/privacy',
	'/terms',
	'/summer',
	'/changelog',
	'/stats',
	'/subjects',
	'/super',
	'/practice-tests',
	'/pricing'
]);

const PUBLIC_READ_PREFIXES = ['/practice', '/blog', '/q'] as const;

export function matchesPublicMarketingPath(pathname: string): boolean {
	if (PUBLIC_READ_EXACT.has(pathname)) return true;
	return PUBLIC_READ_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

const GOOGLE_ONE_TAP_EXACT = new Set(['/', '/about', '/summer', '/changelog', '/stats', '/login']);

/** Public surfaces where Google One Tap may prompt. */
export function isGoogleOneTapRoute(pathname: string): boolean {
	if (GOOGLE_ONE_TAP_EXACT.has(pathname)) return true;
	return matchesPathPrefix(pathname, '/blog') || matchesPathPrefix(pathname, '/practice');
}
