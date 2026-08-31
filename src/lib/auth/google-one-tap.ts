import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { invalidateAuthenticatedShell } from '$lib/client/invalidate-data.js';
import { isGoogleOneTapRoute } from '$lib/routes/public-marketing.js';
import { authClient, googleClientId } from '$lib/auth/client.js';
import { captureSignupCompleted, captureUserLoggedIn } from '$lib/client/activation-analytics';
import { identifyPostHogUser } from '$lib/client/posthog-analytics';

type OneTapContext = 'signin' | 'signup' | 'use';

const NEW_ACCOUNT_WINDOW_MS = 60_000;

let activePromptPath: string | null = null;
const promptedPaths = new Set<string>();

function getOneTapContext(pathname: string): OneTapContext {
	if (pathname === '/signup') return 'signup';
	if (pathname.startsWith('/practice')) return 'use';
	return 'signin';
}

function isLikelyNewAccount(createdAt: unknown): boolean {
	if (createdAt == null) return false;
	const createdMs = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
	if (!Number.isFinite(createdMs)) return false;
	return Date.now() - createdMs < NEW_ACCOUNT_WINDOW_MS;
}

function handleOneTapSuccess(pathname: string, isNewUser: boolean): void {
	if (pathname === '/' || pathname === '/login' || pathname === '/signup') {
		void goto(resolve(isNewUser ? '/app/onboarding' : '/app'));
		return;
	}

	if (isNewUser) {
		void goto(resolve('/app/onboarding'));
		return;
	}

	void invalidateAuthenticatedShell();
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

/** Cancel any in-flight Google One Tap prompt (FedCM / GIS). */
export function cancelGoogleOneTap(): void {
	if (!browser) return;

	window.google?.accounts?.id?.cancel?.();
	activePromptPath = null;
}

/**
 * Prompt Google One Tap on allowed public routes via Better Auth's `oneTapClient`.
 * Onboarding pending cookie is set server-side in `databaseHooks.user.create.after`.
 */
export async function maybePromptGoogleOneTap(pathname: string): Promise<void> {
	if (!browser || !googleClientId) return;
	if (!('oneTap' in authClient)) return;
	if (!isGoogleOneTapRoute(pathname)) return;
	if (promptedPaths.has(pathname)) return;
	if (activePromptPath === pathname) return;

	const { data } = await authClient.getSession();
	if (data?.session) return;
	if (activePromptPath !== null && activePromptPath !== pathname) return;

	activePromptPath = pathname;
	promptedPaths.add(pathname);

	try {
		await authClient.oneTap({
			context: getOneTapContext(pathname),
			fetchOptions: {
				onSuccess(ctx) {
					const user = (ctx.data as { user?: { id?: string; createdAt?: unknown } } | null)
						?.user;
					const isNewUser = isLikelyNewAccount(user?.createdAt);
					captureOneTapAnalytics(pathname, user);
					handleOneTapSuccess(pathname, isNewUser);
				}
			}
		});
	} catch (error) {
		console.error('Google One Tap failed:', error);
	} finally {
		if (activePromptPath === pathname) {
			activePromptPath = null;
		}
	}
}
