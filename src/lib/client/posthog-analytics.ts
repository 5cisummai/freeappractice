import posthog from 'posthog-js';
import { PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public';
import { hasAnalyticsConsent } from '$lib/client/analytics-consent';

let initialized = false;

export function initPostHogAnalytics() {
	if (initialized || typeof window === 'undefined' || !hasAnalyticsConsent()) return;

	posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
		api_host: 'https://t.freeappractice.org',
		ui_host: 'https://us.posthog.com',
		defaults: '2026-01-30',
		capture_exceptions: true,
		opt_out_capturing_by_default: false
	});
	posthog.opt_in_capturing();
	initialized = true;
}

export function teardownPostHogAnalytics() {
	if (!initialized || typeof window === 'undefined') return;

	posthog.opt_out_capturing();
	posthog.reset(true);
	initialized = false;
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
