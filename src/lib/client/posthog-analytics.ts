import posthog from 'posthog-js';
import { PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public';
import { hasAnalyticsConsent, readAnalyticsConsent } from '$lib/client/analytics-consent';
import type { AnalyticsConsent } from '$lib/analytics-consent';

let initialized = false;
const MAX_PENDING_OPERATIONS = 100;

type PendingOperation =
	| { kind: 'capture'; event: string; properties?: Record<string, unknown> }
	| { kind: 'identify'; distinctId: string; properties?: Record<string, unknown> };

let pendingOperations: PendingOperation[] = [];

export function initPostHogAnalytics() {
	if (!import.meta.env.PROD || initialized || typeof window === 'undefined') {
		return;
	}

	posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
		api_host: 'https://t.freeappractice.org',
		ui_host: 'https://us.posthog.com',
		defaults: '2026-05-30',
		capture_exceptions: true,
		cookieless_mode: 'on_reject',
		capture_pageview: false,
		session_recording: {
			maskAllInputs: true,
			// Elements marked with .ph-mask-pii (names, emails, etc.) are hashed in replays.
			maskTextSelector: '.ph-mask-pii',
			maskCapturedNetworkRequestFn: (request) => {
				if (request.name) {
					request.name = request.name.replace(/([?&](email|token|auth)=)[^&]+/gi, '$1[REDACTED]');
				}
				return request;
			}
		}
	});
	initialized = true;
	syncPostHogConsentFromStorage();
}

function syncPostHogConsentFromStorage() {
	if (!initialized || typeof window === 'undefined') return;

	applyPostHogConsent(readAnalyticsConsent());
}

export function applyPostHogConsent(consent: AnalyticsConsent) {
	if (!initialized || typeof window === 'undefined') return;

	if (consent === 'granted') {
		posthog.opt_in_capturing({ captureEventName: false });
		for (const operation of pendingOperations) {
			if (operation.kind === 'capture') {
				posthog.capture(operation.event, operation.properties);
			} else {
				posthog.identify(operation.distinctId, operation.properties);
			}
		}
		pendingOperations = [];
		return;
	}

	if (consent === 'denied') {
		pendingOperations = [];
		posthog.opt_out_capturing();
	}
}

export function resetPostHogConsent() {
	pendingOperations = [];
	if (!initialized || typeof window === 'undefined') return;
	posthog.reset(true);
}

export function capturePostHogEvent(event: string, properties?: Record<string, unknown>) {
	const consent = readAnalyticsConsent();
	if (consent === null) {
		queuePendingOperation({ kind: 'capture', event, properties });
		initPostHogAnalytics();
		return;
	}
	if (consent === 'denied') return;

	initPostHogAnalytics();
	if (initialized) {
		posthog.capture(event, properties);
	}
}

export function identifyPostHogUser(distinctId: string, properties?: Record<string, unknown>) {
	const consent = readAnalyticsConsent();
	if (consent === null) {
		queuePendingOperation({ kind: 'identify', distinctId, properties });
		initPostHogAnalytics();
		return;
	}
	if (consent === 'denied') return;

	initPostHogAnalytics();
	if (initialized) {
		posthog.identify(distinctId, properties);
	}
}

export function capturePostHogPageview(url?: string) {
	const consent = readAnalyticsConsent();
	if (consent === null) return;

	initPostHogAnalytics();
	if (initialized) {
		posthog.capture('$pageview', url ? { $current_url: url } : undefined);
	}
}

export function resetPostHogUser() {
	pendingOperations = [];
	if (initialized && typeof window !== 'undefined') {
		posthog.reset();
	}
}

export function capturePostHogException(error: unknown) {
	if (!hasAnalyticsConsent()) return;

	initPostHogAnalytics();
	if (initialized) {
		posthog.captureException(error);
	}
}

function queuePendingOperation(operation: PendingOperation) {
	if (pendingOperations.length >= MAX_PENDING_OPERATIONS) {
		pendingOperations.shift();
	}
	pendingOperations.push(operation);
}
