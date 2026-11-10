export const ANALYTICS_CONSENT_KEY = 'fap_analytics_consent';

export type AnalyticsConsent = 'granted' | 'denied' | null;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function asAnalyticsConsent(value: string | null | undefined): AnalyticsConsent {
	if (value === 'granted' || value === 'denied') return value;
	return null;
}

function readConsentCookie(): AnalyticsConsent {
	if (typeof document === 'undefined') return null;

	try {
		const match = document.cookie.match(new RegExp(`(?:^|; )${ANALYTICS_CONSENT_KEY}=([^;]*)`));
		return asAnalyticsConsent(match?.[1]);
	} catch {
		return null;
	}
}

export function readAnalyticsConsent(): AnalyticsConsent {
	if (typeof window === 'undefined') return null;

	try {
		const saved = asAnalyticsConsent(localStorage.getItem(ANALYTICS_CONSENT_KEY));
		if (saved) return saved;
	} catch {
		// Safari/WebKit throws SecurityError when storage is blocked.
		return readConsentCookie();
	}

	return null;
}

export function hasAnalyticsConsent(): boolean {
	return readAnalyticsConsent() === 'granted';
}

export function persistAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
	} catch {
		// Storage can be blocked independently of cookies.
	}

	try {
		const secure = window.location.protocol === 'https:' ? '; Secure' : '';
		document.cookie = `${ANALYTICS_CONSENT_KEY}=${consent}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
	} catch {
		// Ignore blocked cookies.
	}
}

export function clearAnalyticsConsentStorage() {
	if (typeof window === 'undefined') return;

	try {
		localStorage.removeItem(ANALYTICS_CONSENT_KEY);
	} catch {
		// Ignore blocked storage; still clear the cookie.
	}

	try {
		document.cookie = `${ANALYTICS_CONSENT_KEY}=; path=/; max-age=0`;
	} catch {
		// Ignore blocked cookies.
	}
}

/** Backfill the consent cookie for visitors who chose before cookie sync existed. */
export function syncAnalyticsConsentCookie() {
	const consent = readAnalyticsConsent();
	if (consent) {
		persistAnalyticsConsent(consent);
	}
}
