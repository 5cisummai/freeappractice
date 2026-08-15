import * as Sentry from '@sentry/sveltekit';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
import { initPostHogAnalytics, capturePostHogException } from '$lib/client/posthog-analytics';
import { sentryOptions } from '$lib/sentry-config';
import type { HandleClientError } from '@sveltejs/kit';

let vercelAnalyticsLoaded = false;

Sentry.init(sentryOptions);

export async function init() {
	initPostHogAnalytics();
	if (!vercelAnalyticsLoaded && typeof window !== 'undefined') {
		injectAnalytics();
		injectSpeedInsights();
		vercelAnalyticsLoaded = true;
	}
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
