import * as Sentry from '@sentry/sveltekit';
import { initPostHogAnalytics, capturePostHogException } from '$lib/client/posthog-analytics';
import { initVercelAnalytics } from '$lib/client/vercel-analytics';
import type { HandleClientError } from '@sveltejs/kit';

// If you don't want to use Session Replay, remove the `Replay` integration,
// `replaysSessionSampleRate` and `replaysOnErrorSampleRate` options.
Sentry.init({
	dsn: 'https://232093562e45ef93e51f60c4e90108db@o4511759649472512.ingest.us.sentry.io/4511759658909696',
	tracesSampleRate: 1,
	enableLogs: true,
	dataCollection: {
		// To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
		// https://docs.sentry.io/platforms/javascript/guides/sveltekit/configuration/options/#dataCollection
		// userInfo: false,
		// httpBodies: [],
	}
});

export async function init() {
	initPostHogAnalytics();
	initVercelAnalytics();
}

export const handleError: HandleClientError = Sentry.handleErrorWithSentry(
	async ({ error, status, message }) => {
		capturePostHogException(error);

		return {
			message,
			status
		};
	}
);
