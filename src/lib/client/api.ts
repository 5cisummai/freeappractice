import { getStoredAuthToken } from '$lib/client/auth-storage.js';

export interface ApiMessageResponse {
	error?: string;
	message?: string;
}

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

/** Authenticated fetch — automatically injects the Bearer token. */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	const token = getStoredAuthToken();
	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}
	if (typeof init.body === 'string' && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}
	return fetch(url, { ...init, headers });
}
