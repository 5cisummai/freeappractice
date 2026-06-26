import posthog from 'posthog-js';
import { PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public';
import {
	hasAnalyticsConsent,
	readAnalyticsConsent
} from '$lib/client/analytics-consent';
import type { AnalyticsConsent } from '$lib/analytics-consent';

let initialized = false;

function isProduction() {
	return import.meta.env.PROD;
}

export function initPostHogAnalytics() {
	if (!isProduction() || initialized || typeof window === 'undefined') {
		return;
	}

	posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
		api_host: 'https://t.freeappractice.org',
		ui_host: 'https://us.posthog.com',
		defaults: '2026-05-30',
		capture_exceptions: true,
		cookieless_mode: 'on_reject',
		capture_pageview: false
	});
	initialized = true;
	syncPostHogConsentFromStorage();
}

export function syncPostHogConsentFromStorage() {
	if (!initialized || typeof window === 'undefined') return;

	applyPostHogConsent(readAnalyticsConsent());
}

export function applyPostHogConsent(consent: AnalyticsConsent) {
	if (!initialized || typeof window === 'undefined') return;

	if (consent === 'granted') {
		posthog.opt_in_capturing({ captureEventName: false });
		posthog.capture('$pageview');
		return;
	}

	if (consent === 'denied') {
		posthog.opt_out_capturing();
	}
}

export function resetPostHogConsent() {
	if (!initialized || typeof window === 'undefined') return;

	posthog.reset(true);
}

export function capturePostHogEvent(event: string, properties?: Record<string, unknown>) {
	if (!hasAnalyticsConsent()) return;

	initPostHogAnalytics();
	if (initialized) {
		posthog.capture(event, properties);
	}
}

export function identifyPostHogUser(distinctId: string, properties?: Record<string, unknown>) {
	if (!hasAnalyticsConsent()) return;

	initPostHogAnalytics();
	if (initialized) {
		posthog.identify(distinctId, properties);
	}
}

export function capturePostHogException(error: unknown) {
	if (!hasAnalyticsConsent()) return;

	initPostHogAnalytics();
	if (initialized) {
		posthog.captureException(error);
	}
}
