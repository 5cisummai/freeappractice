import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { invalidateAuthenticatedShell } from '$lib/client/invalidate-data.js';
import { isGoogleOneTapRoute } from '$lib/routes/public-marketing.js';
import { authClient, googleClientId } from '$lib/auth/client.js';
import { captureSignupCompleted, captureUserLoggedIn } from '$lib/client/activation-analytics';
import { identifyPostHogUser } from '$lib/client/posthog-analytics';

type OneTapContext = 'signin' | 'signup' | 'use';

const PROMPT_SETTLE_TIMEOUT_MS = 60_000;
const NEW_ACCOUNT_WINDOW_MS = 60_000;

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

	void invalidateAuthenticatedShell();
}

function isLikelyNewAccount(createdAt: unknown): boolean {
	if (createdAt == null) return false;
	const createdMs = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
	if (!Number.isFinite(createdMs)) return false;
	return Date.now() - createdMs < NEW_ACCOUNT_WINDOW_MS;
}

function captureOneTapAnalytics(
	pathname: string,
	user: { id?: string; createdAt?: unknown } | null | undefined
): void {
	const userId = user?.id?.trim();
	if (userId) identifyPostHogUser(userId);

	captureUserLoggedIn('google_one_tap');

	const context = getOneTapContext(pathname);
	if (context === 'signup' || isLikelyNewAccount(user?.createdAt)) {
		captureSignupCompleted('google_one_tap');
	}
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
let googleIdentityInitialized = false;
let activeCredentialHandler: ((credential: string) => void) | null = null;
const promptedPaths = new Set<string>();

async function submitOneTapCredential(idToken: string, pathname: string): Promise<boolean> {
	const result = await authClient.$fetch<{
		user?: { id?: string; createdAt?: unknown };
		error?: unknown;
	}>('/one-tap/callback', {
		method: 'POST',
		body: { idToken }
	});

	if (result?.error) return false;

	captureOneTapAnalytics(pathname, result?.data?.user);
	handleOneTapSuccess(pathname);
	return true;
}

function initializeGoogleIdentity(context: OneTapContext): void {
	if (googleIdentityInitialized) return;

	window.google?.accounts.id.initialize({
		client_id: googleClientId,
		use_fedcm_for_prompt: true,
		itp_support: true,
		cancel_on_tap_outside: true,
		context,
		callback: (response: { credential: string }) => {
			const handler = activeCredentialHandler;
			if (handler) {
				handler(response.credential);
				return;
			}

			void submitOneTapCredential(response.credential, window.location.pathname);
		}
	});

	googleIdentityInitialized = true;
}

function runFedcmPrompt(context: OneTapContext, pathname: string): Promise<void> {
	return new Promise((resolvePrompt) => {
		let settled = false;
		let timeout: ReturnType<typeof setTimeout> | null = null;

		const finish = () => {
			if (settled) return;
			settled = true;
			if (timeout) clearTimeout(timeout);
			if (activeCredentialHandler === credentialHandler) {
				activeCredentialHandler = null;
			}
			promptedPaths.add(pathname);
			resolvePrompt();
		};

		const credentialHandler = (credential: string) => {
			void (async () => {
				try {
					await submitOneTapCredential(credential, pathname);
				} finally {
					finish();
				}
			})();
		};

		activeCredentialHandler = credentialHandler;
		initializeGoogleIdentity(context);

		timeout = setTimeout(finish, PROMPT_SETTLE_TIMEOUT_MS);
		window.google?.accounts.id.prompt();
	});
}

export function cancelGoogleOneTap(): void {
	if (!browser) return;

	window.google?.accounts.id?.cancel?.();
	activeCredentialHandler = null;
	activePromptPath = null;
}

export async function maybePromptGoogleOneTap(pathname: string): Promise<void> {
	if (!browser || !googleClientId) return;
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
