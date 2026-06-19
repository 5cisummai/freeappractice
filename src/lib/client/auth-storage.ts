export const TOKEN_KEY_NAME = 'fap_token';
export const USER_KEY_NAME = 'fap_user';

export function getStoredAuthToken(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem(TOKEN_KEY_NAME);
}
