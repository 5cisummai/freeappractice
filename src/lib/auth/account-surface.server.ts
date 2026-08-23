const ACCOUNT_API_PREFIXES = [
	'/api/me',
	'/api/super',
	'/api/coach',
	'/api/tutor',
	'/api/study-plan',
	'/api/question/frq',
	'/api/question/feedback',
	'/api/orgs',
	'/api/shared-practice-sets'
] as const;

function matchesPath(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Account pages and APIs that need the age confirmation gate. */
export function isAccountSurface(pathname: string): boolean {
	return (
		matchesPath(pathname, '/app') ||
		ACCOUNT_API_PREFIXES.some((prefix) => matchesPath(pathname, prefix))
	);
}

/** Paths that must remain usable while a user confirms their age. */
export function isAgeGateExempt(pathname: string): boolean {
	return (
		pathname.startsWith('/api/auth/') ||
		pathname === '/api/me/subjects' ||
		pathname === '/api/super/confirm-age' ||
		matchesPath(pathname, '/app/onboarding') ||
		matchesPath(pathname, '/app/confirm-age')
	);
}

export function shouldSkipSessionLookup(method: string, pathname: string): boolean {
	return method === 'POST' && pathname === '/api/question';
}
