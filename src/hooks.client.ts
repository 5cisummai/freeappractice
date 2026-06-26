import { initPostHogAnalytics, capturePostHogException } from '$lib/client/posthog-analytics';
import { hasAnalyticsConsent } from '$lib/client/analytics-consent';
import type { HandleClientError } from '@sveltejs/kit';

export async function init() {
	if (hasAnalyticsConsent()) {
		initPostHogAnalytics();
	}
}

export const handleError: HandleClientError = async ({ error, status, message }) => {
	capturePostHogException(error);

	return {
		message,
		status
	};
};
