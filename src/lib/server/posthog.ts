import { PostHog } from 'posthog-node';
import { PUBLIC_POSTHOG_PROJECT_TOKEN, PUBLIC_POSTHOG_HOST } from '$env/static/public';
import { hasAnalyticsConsent } from '$lib/server/analytics-consent';

let posthogClient: PostHog | null = null;

type ServerCaptureEvent = {
	distinctId: string;
	event: string;
	properties?: Record<string, unknown>;
};

export function getPostHogClient() {
	if (!posthogClient) {
		posthogClient = new PostHog(PUBLIC_POSTHOG_PROJECT_TOKEN, {
			host: PUBLIC_POSTHOG_HOST,
			flushAt: 1,
			flushInterval: 0
		});
	}
	return posthogClient;
}

export function capturePostHogServerEvent(request: Request, event: ServerCaptureEvent) {
	if (!hasAnalyticsConsent(request)) return;

	getPostHogClient().capture(event);
}

export async function shutdownPostHog() {
	if (posthogClient) {
		await posthogClient.shutdown();
	}
}
