import * as Sentry from '@sentry/sveltekit';
import { initPostHogAnalytics, capturePostHogException } from '$lib/client/posthog-analytics';
import { initVercelAnalytics } from '$lib/client/vercel-analytics';
import { sentryOptions } from '$lib/sentry-config';
import type { HandleClientError } from '@sveltejs/kit';

Sentry.init(sentryOptions);

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
