/**
 * Shared Google Sign-In logic for login and signup forms.
 */

import { auth } from '$lib/client/auth.svelte.js';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GSI_SCRIPT_ID = 'google-gsi';

let gsiScriptPromise: Promise<void> | null = null;

/**
 * Load the Google Identity Services script once (client-only). No `crossorigin` — that URL does not
 * send ACAO and would fail under CORS. Loaded when sign-in UI mounts instead of app.html so the
 * document shell stays minimal; `script-src` already allows this host.
 */
function ensureGoogleGsiScript(): Promise<void> {
	if (typeof window === 'undefined') return Promise.resolve();
	if (window.google?.accounts) return Promise.resolve();
	if (gsiScriptPromise) return gsiScriptPromise;

	gsiScriptPromise = new Promise((resolve, reject) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			gsiScriptPromise = null;
			resolve();
		};
		const fail = () => {
			if (settled) return;
			settled = true;
			gsiScriptPromise = null;
			reject(new Error('Failed to load Google Sign-In'));
		};

		let script = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
		if (!script) {
			script = document.createElement('script');
			script.id = GSI_SCRIPT_ID;
			script.async = true;
			script.src = GSI_SCRIPT_URL;
			script.addEventListener('load', finish, { once: true });
			script.addEventListener('error', fail, { once: true });
			document.head.appendChild(script);
		} else {
			script.addEventListener('load', finish, { once: true });
			script.addEventListener('error', fail, { once: true });
		}

		if (window.google?.accounts) finish();
		// If the script was already in the DOM and `load` already fired, wait one tick for `google`.
		queueMicrotask(() => {
			if (window.google?.accounts) finish();
		});
	});

	return gsiScriptPromise;
}

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
 * Set up Google Sign-In: loads GSI on the client if needed, then initializes. Call from onMount.
 */
export function setupGoogleSignIn(
	getContainer: () => HTMLDivElement | null,
	onError: (message: string) => void
): void {
	const container = getContainer();
	if (!container) return;

	if (window.google?.accounts) {
		initGoogleSignIn(container, onError);
		return;
	}

	void ensureGoogleGsiScript()
		.then(() => {
			const el = getContainer();
			if (!el) return;
			if (!window.google?.accounts) {
				onError('Failed to load Google Sign-In');
				return;
			}
			initGoogleSignIn(el, onError);
		})
		.catch(() => onError('Failed to load Google Sign-In'));
}
