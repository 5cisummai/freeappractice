import type { HandleClientError } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { isDynamicImportFailure, reloadOnceForChunkFailure } from '#lib/client/chunk-recovery.js';
import { initPostHogAnalytics, capturePostHogException } from '#lib/client/posthog-analytics.js';
import { sentryEnabled, sentryOptions } from '#lib/sentry-config.js';
import { isIgnoredSentryError } from '#lib/sentry-ignore.js';

if (sentryEnabled) {
	Sentry.init(sentryOptions);
}

if (typeof window !== 'undefined') {
	window.addEventListener('vite:preloadError', (event: Event) => {
		if (reloadOnceForChunkFailure()) event.preventDefault();
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
		isDynamicImportFailure(input.error) &&
		reloadOnceForChunkFailure()
	) {
		return;
	}
	return reportError(input);
};
