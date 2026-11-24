export type AccountCreationMethod = 'email' | 'google' | 'google_one_tap' | 'apple' | 'unknown';

export interface AccountCreationContext {
	path?: string | null;
	params?: Record<string, unknown> | null;
	body?: unknown;
	requestUrl?: string | null;
}

function normalizeProvider(value: unknown): AccountCreationMethod | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().toLowerCase();
	if (normalized === 'google') return 'google';
	if (normalized === 'apple') return 'apple';
	return null;
}

export function classifyAccountCreationMethod(
	input?: string | AccountCreationContext | null
): AccountCreationMethod {
	if (!input) return 'unknown';
	const context: AccountCreationContext = typeof input === 'string' ? { path: input } : input;
	const path = context.path ?? '';

	if (path.includes('/sign-up/email')) return 'email';
	if (path.includes('/one-tap/callback')) return 'google_one_tap';
	if (path.includes('/callback/google')) return 'google';
	if (path.includes('/callback/apple')) return 'apple';

	if (path.includes('/callback/')) {
		const fromParams = normalizeProvider(context.params?.id);
		if (fromParams) return fromParams;
		if (context.requestUrl) {
			if (context.requestUrl.includes('/callback/google')) return 'google';
			if (context.requestUrl.includes('/callback/apple')) return 'apple';
		}
	}

	if (path.includes('/sign-in/social') && context.body && typeof context.body === 'object') {
		const fromBody = normalizeProvider((context.body as Record<string, unknown>).provider);
		if (fromBody) return fromBody;
	}

	return 'unknown';
}
