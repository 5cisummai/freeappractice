export type AccountCreationMethod = 'email' | 'google' | 'google_one_tap' | 'unknown';

export function classifyAccountCreationMethod(path?: string): AccountCreationMethod {
	if (!path) return 'unknown';
	if (path.includes('/sign-up/email')) return 'email';
	if (path.includes('/one-tap/callback')) return 'google_one_tap';
	if (path.includes('/callback/google')) return 'google';
	return 'unknown';
}
