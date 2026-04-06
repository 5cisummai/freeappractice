/**
 * Client-side authentication state.
 * Uses Svelte 5 runes in a .svelte.ts module for reactive shared state.
 */

const TOKEN_KEY_NAME = 'fap_token';
const USER_KEY_NAME = 'fap_user';

export interface AuthUser {
	userId: string;
	name: string;
	email: string;
}

export interface ApiMessageResponse {
	error?: string;
	message?: string;
}

function createAuthState() {
	let token = $state<string | null>(null);
	let user = $state<AuthUser | null>(null);
	let initialized = $state(false);

	function init() {
		if (initialized) return;
		if (typeof window === 'undefined') return;
		token = localStorage.getItem(TOKEN_KEY_NAME);
		const raw = localStorage.getItem(USER_KEY_NAME);
		try {
			user = raw ? JSON.parse(raw) : null;
		} catch {
			user = null;
			localStorage.removeItem(USER_KEY_NAME);
		}
		initialized = true;
	}

	function setAuth(newToken: string, newUser: AuthUser) {
		token = newToken;
		user = newUser;
		localStorage.setItem(TOKEN_KEY_NAME, newToken);
		localStorage.setItem(USER_KEY_NAME, JSON.stringify(newUser));
	}

	function clearAuth() {
		token = null;
		user = null;
		localStorage.removeItem(TOKEN_KEY_NAME);
		localStorage.removeItem(USER_KEY_NAME);
	}

	return {
		get token() {
			return token;
		},
		get user() {
			return user;
		},
		get isAuthenticated() {
			return token !== null && user !== null;
		},
		get initialized() {
			return initialized;
		},
		init,
		setAuth,
		clearAuth
	};
}

export const auth = createAuthState();

export async function readJsonOrNull<T>(response: Response): Promise<T | null> {
	const text = await response.text();
	if (!text) return null;

	try {
		return JSON.parse(text) as T;
	} catch {
		return null;
	}
}

export function getResponseMessage(
	payload: ApiMessageResponse | null | undefined,
	fallback: string
): string {
	const candidate = payload?.error ?? payload?.message;
	return typeof candidate === 'string' && candidate.trim() ? candidate : fallback;
}

/**
 * Authenticated fetch - automatically injects the Bearer token.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	if (auth.token) {
		headers.set('Authorization', `Bearer ${auth.token}`);
	}
	if (typeof init.body === 'string' && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}
	return fetch(url, { ...init, headers });
}
