import posthog from 'posthog-js';
import { PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public';
import { readAnalyticsConsent } from '$lib/client/analytics-consent';
import type { AnalyticsConsent } from '$lib/analytics-consent';
import { getPostHogOperationDisposition } from '$lib/client/posthog-consent-policy';

let initialized = false;
const MAX_PENDING_OPERATIONS = 100;

type PostHogOperation =
	| { kind: 'capture'; event: string; properties?: Record<string, unknown> }
	| { kind: 'identify'; distinctId: string; properties?: Record<string, unknown> }
	| { kind: 'pageview'; url?: string }
	| { kind: 'pageleave'; url?: string }
	| { kind: 'exception'; error: unknown };

type PendingOperation = Extract<PostHogOperation, { kind: 'capture' | 'identify' }>;

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
		// Pending + rejected visitors get cookieless page traffic; cookies only after opt_in.
		cookieless_mode: 'on_reject',
		opt_out_capturing_by_default: true,
		// Manual $pageview + $pageleave so SvelteKit client navigations are counted.
		capture_pageview: false,
		capture_pageleave: false,
		session_recording: {
			maskAllInputs: true,
			// Elements marked with .ph-mask-pii (including conversation messages) are hashed in replays.
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
			sendPostHogOperation(operation);
		}
		pendingOperations = [];
		return;
	}

	if (consent === 'denied') {
		pendingOperations = [];
		// Explicit reject: cookieless_mode on_reject still sends privacy-preserving page traffic.
		posthog.opt_out_capturing();
		return;
	}

	// Pending: leave PostHog in default cookieless capturing (opt_out_capturing_by_default).
	// Do not call opt_out here — that would mark consent DENIED and hide the banner state.
}

export function capturePostHogEvent(event: string, properties?: Record<string, unknown>) {
	dispatchPostHogOperation({ kind: 'capture', event, properties });
}

export function identifyPostHogUser(distinctId: string, properties?: Record<string, unknown>) {
	dispatchPostHogOperation({ kind: 'identify', distinctId, properties });
}

export function capturePostHogPageview(url?: string) {
	dispatchPostHogOperation({ kind: 'pageview', url });
}

export function capturePostHogPageleave(url?: string) {
	dispatchPostHogOperation({ kind: 'pageleave', url });
}

export function resetPostHogUser(options: { clearPersistence?: boolean } = {}) {
	pendingOperations = [];
	if (initialized && typeof window !== 'undefined') {
		posthog.reset(options.clearPersistence ?? false);
	}
}

export function resetPostHogConsent() {
	pendingOperations = [];
	if (!initialized || typeof window === 'undefined') return;

	posthog.opt_out_capturing();
	posthog.reset(true);
}

export function capturePostHogException(error: unknown) {
	dispatchPostHogOperation({ kind: 'exception', error });
}

function dispatchPostHogOperation(operation: PostHogOperation): void {
	const disposition = getPostHogOperationDisposition(readAnalyticsConsent(), operation.kind);
	if (disposition === 'drop') return;

	if (disposition === 'queue') {
		if (operation.kind === 'capture' || operation.kind === 'identify') {
			queuePendingOperation(operation);
		}
		initPostHogAnalytics();
		return;
	}

	initPostHogAnalytics();
	if (initialized) sendPostHogOperation(operation);
}

function queuePendingOperation(operation: PendingOperation) {
	if (pendingOperations.length >= MAX_PENDING_OPERATIONS) {
		pendingOperations.shift();
	}
	pendingOperations.push(operation);
}

function sendPostHogOperation(operation: PostHogOperation): void {
	switch (operation.kind) {
		case 'capture':
			posthog.capture(operation.event, operation.properties);
			return;
		case 'identify':
			posthog.identify(operation.distinctId, operation.properties);
			return;
		case 'pageview':
			posthog.capture('$pageview', operation.url ? { $current_url: operation.url } : undefined);
			return;
		case 'pageleave':
			posthog.capture('$pageleave', operation.url ? { $current_url: operation.url } : undefined);
			return;
		case 'exception':
			posthog.captureException(operation.error);
			return;
		default: {
			const exhaustiveOperation: never = operation;
			return exhaustiveOperation;
		}
	}
}
