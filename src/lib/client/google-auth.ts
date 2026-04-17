/**
 * Shared Google Sign-In logic for login and signup forms.
 */

import { auth } from '$lib/client/auth.svelte.js';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

/**
 * Handle a Google credential response: exchange it for a session token and navigate to /app.
 * Returns an error message string on failure, or null on success.
 */
export async function handleGoogleCredential(credential: string): Promise<string | null> {
	try {
		const res = await fetch('/api/auth/google', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken: credential })
		});
		const data = await res.json();
		if (!res.ok) {
			return data.error ?? 'Google sign-in failed';
		}
		auth.setAuth(data.token, data.user);
		goto(resolve('/app'));
		return null;
	} catch {
		return 'Network error. Please try again.';
	}
}

/**
 * Initialize the Google Sign-In button and render it into the given container.
 * Call from onMount or after the Google GSI script has loaded.
 */
export function initGoogleSignIn(
	container: HTMLDivElement,
	onError: (message: string) => void
): void {
	if (!window.google?.accounts) return;
	window.google.accounts.id.initialize({
		client_id: PUBLIC_GOOGLE_CLIENT_ID,
		callback: async (response: { credential: string }) => {
			const error = await handleGoogleCredential(response.credential);
			if (error) onError(error);
		}
	});
	window.google.accounts.id.renderButton(container, {
		type: 'standard',
		theme: 'outline',
		size: 'large',
		width: String(container.offsetWidth || 400)
	});
}

/**
 * Set up Google Sign-In: initializes immediately if the GSI script is loaded,
 * otherwise waits for it. Call from onMount.
 */
export function setupGoogleSignIn(
	getContainer: () => HTMLDivElement | null,
	onError: (message: string) => void
): void {
	const container = getContainer();
	if (!container) return;

	if (window.google?.accounts) {
		initGoogleSignIn(container, onError);
	} else {
		const script = document.getElementById('google-gsi') as HTMLScriptElement | null;
		if (script) {
			script.addEventListener('load', () => {
				const el = getContainer();
				if (el) initGoogleSignIn(el, onError);
			});
		}
	}
}
