import type { AnalyticsConsent } from '$lib/analytics-consent';
import {
	clearAnalyticsConsentStorage,
	persistAnalyticsConsent,
	readAnalyticsConsent,
	syncAnalyticsConsentCookie
} from '$lib/client/analytics-consent';
import {
	applyPostHogConsent,
	capturePostHogEvent,
	initPostHogAnalytics,
	resetPostHogConsent
} from '$lib/client/posthog-analytics';

function createPrivacyState() {
	let analyticsConsent = $state<AnalyticsConsent>(null);
	let initialized = $state(false);

	function init() {
		if (initialized || typeof window === 'undefined') return;

		syncAnalyticsConsentCookie();

		const saved = readAnalyticsConsent();
		if (saved) analyticsConsent = saved;

		initialized = true;
		initPostHogAnalytics();
	}

	function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
		analyticsConsent = consent;
		initialized = true;
		persistAnalyticsConsent(consent);
		initPostHogAnalytics();
		applyPostHogConsent(consent);

		if (consent === 'granted') {
			capturePostHogEvent('analytics_consent_changed', { consent: 'granted' });
		}
	}

	function clearAnalyticsConsent() {
		analyticsConsent = null;
		initialized = true;
		resetPostHogConsent();
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
