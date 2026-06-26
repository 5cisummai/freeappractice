import { initPostHogAnalytics, capturePostHogException } from '$lib/client/posthog-analytics';
import { initVercelAnalytics } from '$lib/client/vercel-analytics';
import type { HandleClientError } from '@sveltejs/kit';

export async function init() {
	initPostHogAnalytics();
	initVercelAnalytics();
}

export const handleError: HandleClientError = async ({ error, status, message }) => {
	capturePostHogException(error);

	return {
		message,
		status
	};
};
