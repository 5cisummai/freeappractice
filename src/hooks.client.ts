import type { HandleClientError } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { initPostHogAnalytics, capturePostHogException } from '#lib/client/posthog-analytics.js';
import { sentryEnabled, sentryOptions } from '#lib/sentry-config.js';
import { isIgnoredSentryError } from '#lib/sentry-ignore.js';

const CHUNK_RELOAD_AT_KEY = 'chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 10_000;

if (sentryEnabled) {
	Sentry.init(sentryOptions);
}

function dynamicImportFailureMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return typeof error === 'string' ? error : '';
}

function isDynamicImportFailure(error: unknown): boolean {
	const message = dynamicImportFailureMessage(error);

	return (
		message.includes('Failed to fetch dynamically imported module') ||
		message.includes('Importing a module script failed') ||
		message.includes('error loading dynamically imported module')
	);
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
	if (isIgnoredSentryError(error)) return;
	if (isDynamicImportFailure(error) && reloadOnceForChunkFailure()) return;

	capturePostHogException(error);
});
