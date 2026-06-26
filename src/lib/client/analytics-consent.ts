import { ANALYTICS_CONSENT_KEY, type AnalyticsConsent } from '$lib/analytics-consent';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readAnalyticsConsent(): AnalyticsConsent {
	if (typeof window === 'undefined') return null;

	const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY);
	if (saved === 'granted' || saved === 'denied') return saved;

	return null;
}

export function hasAnalyticsConsent(): boolean {
	return readAnalyticsConsent() === 'granted';
}

export function persistAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
	if (typeof window === 'undefined') return;

	localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);

	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${ANALYTICS_CONSENT_KEY}=${consent}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearAnalyticsConsentStorage() {
	if (typeof window === 'undefined') return;

	localStorage.removeItem(ANALYTICS_CONSENT_KEY);
	document.cookie = `${ANALYTICS_CONSENT_KEY}=; path=/; max-age=0`;
}

/** Backfill the consent cookie for visitors who chose before cookie sync existed. */
export function syncAnalyticsConsentCookie() {
	const consent = readAnalyticsConsent();
	if (consent) {
		persistAnalyticsConsent(consent);
	}
}
