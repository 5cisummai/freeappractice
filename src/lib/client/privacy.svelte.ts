import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
import type { AnalyticsConsent } from '$lib/analytics-consent';
import {
	clearAnalyticsConsentStorage,
	persistAnalyticsConsent,
	readAnalyticsConsent,
	syncAnalyticsConsentCookie
} from '$lib/client/analytics-consent';
import {
	capturePostHogEvent,
	initPostHogAnalytics,
	teardownPostHogAnalytics
} from '$lib/client/posthog-analytics';

function createPrivacyState() {
	let analyticsConsent = $state<AnalyticsConsent>(null);
	let initialized = $state(false);
	let analyticsLoaded = $state(false);

	function loadAnalytics() {
		if (analyticsLoaded || typeof window === 'undefined') return;
		if (import.meta.env.DEV) {
			analyticsLoaded = true;
			return;
		}

		injectAnalytics();
		injectSpeedInsights();
		analyticsLoaded = true;
	}

	function init() {
		if (initialized || typeof window === 'undefined') return;

		syncAnalyticsConsentCookie();

		const saved = readAnalyticsConsent();
		if (saved === 'granted' || saved === 'denied') {
			analyticsConsent = saved;
		}

		initialized = true;
		if (analyticsConsent === 'granted') {
			initPostHogAnalytics();
			loadAnalytics();
		}
	}

	function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
		analyticsConsent = consent;
		initialized = true;
		persistAnalyticsConsent(consent);

		if (consent === 'granted') {
			initPostHogAnalytics();
			loadAnalytics();
			capturePostHogEvent('analytics_consent_changed', { consent: 'granted' });
			return;
		}

		teardownPostHogAnalytics();

		if (analyticsLoaded && typeof window !== 'undefined') {
			window.location.reload();
		}
	}

	function clearAnalyticsConsent() {
		analyticsConsent = null;
		initialized = true;
		teardownPostHogAnalytics();
		clearAnalyticsConsentStorage();
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
