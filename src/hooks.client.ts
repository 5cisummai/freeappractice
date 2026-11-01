import type { HandleClientError } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { initPostHogAnalytics, capturePostHogException } from '#lib/client/posthog-analytics.js';
import { sentryEnabled, sentryOptions } from '#lib/sentry-config.js';
import {
	isIgnoredSentryError,
	isSvelteKitMissingComponentError,
	sentryErrorMessage
} from '#lib/sentry-ignore.js';

const CHUNK_RELOAD_AT_KEY = 'chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 10_000;

function isDynamicImportFailure(error: unknown): boolean {
	const message = sentryErrorMessage(error);

	return (
		message.includes('Failed to fetch dynamically imported module') ||
		message.includes('Importing a module script failed') ||
		message.includes('error loading dynamically imported module')
	);
}

function isRecoverableStaleClientError(error: unknown): boolean {
	return isDynamicImportFailure(error) || isSvelteKitMissingComponentError(error);
}

function hasRecentChunkReload(): boolean {
	if (typeof window === 'undefined') return false;

	try {
		const previous = Number(sessionStorage.getItem(CHUNK_RELOAD_AT_KEY) || 0);
		return Number.isFinite(previous) && Date.now() - previous < CHUNK_RELOAD_WINDOW_MS;
	} catch {
		return false;
	}
}

/** Reload once so a stale tab or a dropped chunk request can pick up the current build. */
function reloadOnceForChunkFailure(): boolean {
	if (typeof window === 'undefined' || hasRecentChunkReload()) return false;

	try {
		sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now()));
	} catch {
		return false;
	}

	window.location.reload();
	return true;
}

if (sentryEnabled) {
	Sentry.init({
		...sentryOptions,
		beforeSend(event, hint) {
			const error = hint.originalException ?? event.message;
			if (!isRecoverableStaleClientError(error)) return event;
			// Drop only when this path successfully starts a one-shot reload.
			// Repeats inside the 10s window must still reach Sentry.
			if (reloadOnceForChunkFailure()) return null;
			return event;
		}
	});
}

if (typeof window !== 'undefined') {
	window.addEventListener('vite:preloadError', (event: Event) => {
		if (reloadOnceForChunkFailure()) event.preventDefault();
	});
	window.addEventListener('unhandledrejection', (event) => {
		if (isRecoverableStaleClientError(event.reason) && reloadOnceForChunkFailure()) {
			event.preventDefault();
		}
	});
}

export async function init() {
	initPostHogAnalytics();
}

const reportError: HandleClientError = Sentry.handleErrorWithSentry(({ kind, error }) => {
	if (kind !== 'unknown') return;
	if (isIgnoredSentryError(error)) return;

	capturePostHogException(error);
});

export const handleError: HandleClientError = (input) => {
	// Decide recovery before Sentry's wrapper captures the exception.
	if (
		input.kind === 'unknown' &&
		isRecoverableStaleClientError(input.error) &&
		reloadOnceForChunkFailure()
	) {
		return;
	}
	return reportError(input);
};
