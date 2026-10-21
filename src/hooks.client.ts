import type { HandleClientError } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { initPostHogAnalytics, capturePostHogException } from '#lib/client/posthog-analytics.js';
import { sentryEnabled, sentryOptions } from '#lib/sentry-config.js';
import { isDynamicImportFailure, isIgnoredSentryError } from '#lib/sentry-ignore.js';

const CHUNK_RELOAD_AT_KEY = 'chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 10_000;

if (sentryEnabled) {
	Sentry.init(sentryOptions);
}

/** Reload once so a stale tab or a dropped chunk request can pick up the current build. */
function reloadOnceForChunkFailure(): boolean {
	if (typeof window === 'undefined') return false;

	try {
		const previous = Number(sessionStorage.getItem(CHUNK_RELOAD_AT_KEY) || 0);
		if (Number.isFinite(previous) && Date.now() - previous < CHUNK_RELOAD_WINDOW_MS) {
			return false;
		}
		sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now()));
	} catch {
		return false;
	}

	window.location.reload();
	return true;
}

if (typeof window !== 'undefined') {
	window.addEventListener('vite:preloadError', (event: Event) => {
		if (reloadOnceForChunkFailure()) event.preventDefault();
	});
}

export async function init() {
	initPostHogAnalytics();
}

export const handleError: HandleClientError = Sentry.handleErrorWithSentry(({ kind, error }) => {
	if (kind !== 'unknown') return;
	if (isDynamicImportFailure(error)) {
		reloadOnceForChunkFailure();
		return;
	}
	if (isIgnoredSentryError(error)) return;

	capturePostHogException(error);
});
