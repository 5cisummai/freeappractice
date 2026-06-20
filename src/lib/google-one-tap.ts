import { browser } from '$app/environment';
import { goto, invalidateAll } from '$app/navigation';
import { resolve } from '$app/paths';
import { authClient, googleClientId, googleOneTapEnabled } from '$lib/auth-client.js';

type OneTapContext = 'signin' | 'signup' | 'use';

const ONE_TAP_ROUTE_PATTERNS = [
	/^\/$/,
	/^\/about$/,
	/^\/summer$/,
	/^\/changelog$/,
	/^\/stats$/,
	/^\/blog(\/.*)?$/,
	/^\/practice(\/.*)?$/,
	/^\/login$/,
	/^\/signup$/
] as const;

export function isGoogleOneTapRoute(pathname: string): boolean {
	return ONE_TAP_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function getOneTapContext(pathname: string): OneTapContext {
	if (pathname === '/signup') return 'signup';
	if (pathname.startsWith('/practice')) return 'use';
	return 'signin';
}

function handleOneTapSuccess(pathname: string): void {
	if (pathname === '/' || pathname === '/login' || pathname === '/signup') {
		goto(resolve('/app'));
		return;
	}

	void invalidateAll();
}

function loadGoogleScript(): Promise<void> {
	return new Promise((resolveScript, reject) => {
		if (window.googleScriptInitialized) {
			resolveScript();
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://accounts.google.com/gsi/client';
		script.async = true;
		script.defer = true;
		script.onload = () => {
			window.googleScriptInitialized = true;
			resolveScript();
		};
		script.onerror = () => {
			reject(new Error('Failed to load Google Identity Services script'));
		};
		document.head.appendChild(script);
	});
}

let activePromptPath: string | null = null;
let promptInFlight = false;
const promptedPaths = new Set<string>();

async function submitOneTapCredential(idToken: string, pathname: string): Promise<boolean> {
	const result = await authClient.$fetch('/one-tap/callback', {
		method: 'POST',
		body: { idToken }
	});

	if (result?.error) return false;

	handleOneTapSuccess(pathname);
	return true;
}

function runFedcmPrompt(context: OneTapContext, pathname: string): Promise<void> {
	return new Promise((resolvePrompt) => {
		let settled = false;

		const finish = () => {
			if (settled) return;
			settled = true;
			promptedPaths.add(pathname);
			resolvePrompt();
		};

		window.google?.accounts.id.initialize({
			client_id: googleClientId,
			use_fedcm_for_prompt: true,
			itp_support: true,
			cancel_on_tap_outside: true,
			context,
			callback: async (response: { credential: string }) => {
				try {
					await submitOneTapCredential(response.credential, pathname);
				} finally {
					finish();
				}
			}
		});

		window.google?.accounts.id.prompt((notification: GoogleOneTapPromptNotification) => {
			if (settled || activePromptPath !== pathname) return;

			// FedCM-compatible prompt lifecycle: only dismissed/skipped moments are supported.
			if (notification.isDismissedMoment?.() || notification.isSkippedMoment?.()) {
				finish();
			}
		});
	});
}

export function cancelGoogleOneTap(): void {
	window.google?.accounts.id?.cancel?.();
	activePromptPath = null;
}

export async function maybePromptGoogleOneTap(pathname: string): Promise<void> {
	if (!browser || !googleOneTapEnabled) return;
	if (!isGoogleOneTapRoute(pathname)) return;
	if (promptedPaths.has(pathname) || promptInFlight) return;
	if (activePromptPath === pathname) return;

	const { data } = await authClient.getSession();
	if (data?.session) return;
	if (activePromptPath !== null && activePromptPath !== pathname) return;

	promptInFlight = true;
	activePromptPath = pathname;

	try {
		await loadGoogleScript();
		if (activePromptPath !== pathname) return;

		await runFedcmPrompt(getOneTapContext(pathname), pathname);
	} catch (error) {
		console.error('Google One Tap failed:', error);
	} finally {
		promptInFlight = false;
		if (activePromptPath === pathname) {
			activePromptPath = null;
		}
	}
}
