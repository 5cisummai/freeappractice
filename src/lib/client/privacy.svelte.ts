import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

const ANALYTICS_CONSENT_KEY = 'fap_analytics_consent';

type AnalyticsConsent = 'granted' | 'denied' | null;

function createPrivacyState() {
	let analyticsConsent = $state<AnalyticsConsent>(null);
	let initialized = $state(false);
	let analyticsLoaded = $state(false);

	function loadAnalytics() {
		if (analyticsLoaded || typeof window === 'undefined') return;

		injectAnalytics();
		injectSpeedInsights();
		analyticsLoaded = true;
	}

	function init() {
		if (initialized || typeof window === 'undefined') return;

		const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY);
		if (saved === 'granted' || saved === 'denied') {
			analyticsConsent = saved;
		}

		initialized = true;
		if (analyticsConsent === 'granted') {
			loadAnalytics();
		}
	}

	function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
		analyticsConsent = consent;
		initialized = true;

		if (typeof window !== 'undefined') {
			localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
		}

		if (consent === 'granted') {
			loadAnalytics();
		}

		if (consent === 'denied' && analyticsLoaded && typeof window !== 'undefined') {
			window.location.reload();
		}
	}

	function clearAnalyticsConsent() {
		analyticsConsent = null;
		initialized = true;

		if (typeof window !== 'undefined') {
			localStorage.removeItem(ANALYTICS_CONSENT_KEY);
		}
	}

	return {
		get analyticsConsent() {
			return analyticsConsent;
		},
		get initialized() {
			return initialized;
		},
		init,
		setAnalyticsConsent,
		clearAnalyticsConsent
	};
}

export const privacy = createPrivacyState();
