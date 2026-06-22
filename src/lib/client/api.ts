import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

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

function redirectToLoginIfNeeded(response: Response): void {
	if (!browser || response.status !== 401) return;

	const path = window.location.pathname;
	if (path.startsWith('/login') || path.startsWith('/signup')) return;

	void goto(resolve('/login'));
}

/** App API fetch. Better Auth uses same-origin cookies for authentication. */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	if (typeof init.body === 'string' && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}
	const response = await fetch(url, {
		...init,
		headers,
		credentials: init.credentials ?? 'same-origin'
	});
	redirectToLoginIfNeeded(response);
	return response;
}
