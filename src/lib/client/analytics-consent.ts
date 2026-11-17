export const ANALYTICS_CONSENT_KEY = 'fap_analytics_consent';

export type AnalyticsConsent = 'granted' | 'denied' | null;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readConsentCookie(): string | undefined {
	try {
		const prefix = `${ANALYTICS_CONSENT_KEY}=`;
		return document.cookie
			.split(';')
			.map((entry) => entry.trim())
			.find((entry) => entry.startsWith(prefix))
			?.slice(prefix.length);
	} catch {
		return undefined;
	}
}

function writeConsentCookie(value: string, maxAge: number) {
	try {
		const secure = window.location.protocol === 'https:' ? '; Secure' : '';
		document.cookie = `${ANALYTICS_CONSENT_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
	} catch {
		// Browsers can block cookie access independently of local storage.
	}
}

export function readAnalyticsConsent(): AnalyticsConsent {
	if (typeof window === 'undefined') return null;

	const cookie = readConsentCookie();
	if (cookie === 'granted' || cookie === 'denied') return cookie;
	if (cookie === 'reset') return null;

	try {
		const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY);
		return saved === 'granted' || saved === 'denied' ? saved : null;
	} catch {
		return null;
	}
}

export function hasAnalyticsConsent(): boolean {
	return readAnalyticsConsent() === 'granted';
}

export function persistAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
	if (typeof window === 'undefined') return;

	try {
		localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
	} catch {
		// The cookie still records the explicit choice when storage is read-only.
	}
	writeConsentCookie(consent, COOKIE_MAX_AGE_SECONDS);
}

export function clearAnalyticsConsentStorage() {
	if (typeof window === 'undefined') return;

	try {
		localStorage.removeItem(ANALYTICS_CONSENT_KEY);
	} catch {
		// A reset cookie prevents a stale local grant from being migrated back.
		writeConsentCookie('reset', COOKIE_MAX_AGE_SECONDS);
		return;
	}
	writeConsentCookie('', 0);
}

/** Backfill the consent cookie for visitors who chose before cookie sync existed. */
export function syncAnalyticsConsentCookie() {
	if (typeof window === 'undefined' || readConsentCookie() !== undefined) return;
	const consent = readAnalyticsConsent();
	if (consent) writeConsentCookie(consent, COOKIE_MAX_AGE_SECONDS);
}
