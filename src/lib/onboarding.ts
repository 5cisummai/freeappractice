export const ONBOARDING_COOKIE_NAME = 'onboarding-hints';
export const ONBOARDING_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const ONBOARDING_INTENT_COOKIE_NAME = 'onboarding-intent';
export const ONBOARDING_INTENT_COOKIE_MAX_AGE = 60 * 60 * 24;

export type OnboardingIntent = 'free' | 'super';

export type OnboardingState =
	| { status: 'unset'; subjects: string[] }
	| { status: 'pending'; subjects: string[] }
	| { status: 'complete'; subjects: string[] };

export function readOnboardingState(value: string | undefined): OnboardingState {
	if (!value) return { status: 'unset', subjects: [] };
	if (value === 'pending') return { status: 'pending', subjects: [] };
	if (value === 'complete') return { status: 'complete', subjects: [] };

	try {
		const parsed = JSON.parse(value) as { status?: string; subjects?: unknown };
		if (parsed.status !== 'complete' || !Array.isArray(parsed.subjects)) {
			return { status: 'unset', subjects: [] };
		}

		return {
			status: 'complete',
			subjects: parsed.subjects.filter((subject): subject is string => typeof subject === 'string')
		};
	} catch {
		return { status: 'unset', subjects: [] };
	}
}

export function serializeCompletedOnboarding(): string {
	return 'complete';
}

export function readOnboardingIntent(value: string | undefined): OnboardingIntent {
	return value === 'super' ? 'super' : 'free';
}

/** Used to carry the user's Super entry point through email and OAuth redirects. */
export function markOnboardingIntentInBrowser(intent: OnboardingIntent): void {
	if (typeof document === 'undefined') return;

	document.cookie = `${ONBOARDING_INTENT_COOKIE_NAME}=${intent}; path=/; max-age=${ONBOARDING_INTENT_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Used before an email verification or OAuth redirect completes. */
export function markOnboardingPendingInBrowser(): void {
	if (typeof document === 'undefined') return;

	document.cookie = `${ONBOARDING_COOKIE_NAME}=pending; path=/; max-age=${ONBOARDING_COOKIE_MAX_AGE}; SameSite=Lax`;
}
