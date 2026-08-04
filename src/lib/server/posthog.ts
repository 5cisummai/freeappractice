import { PostHog } from 'posthog-node';
import { waitUntil } from '@vercel/functions';
import { PUBLIC_POSTHOG_PROJECT_TOKEN, PUBLIC_POSTHOG_HOST } from '$env/static/public';
import { hasAnalyticsConsent } from '$lib/server/analytics-consent';

let posthogClient: PostHog | null = null;

type ServerCaptureEvent = {
	distinctId: string;
	event: string;
	properties?: Record<string, unknown>;
};

/** Anonymous ops metrics — never include user IDs or request bodies. */
const ANONYMOUS_SERVER_DISTINCT_ID = 'server';

function getPostHogClient() {
	if (!posthogClient) {
		posthogClient = new PostHog(PUBLIC_POSTHOG_PROJECT_TOKEN, {
			host: PUBLIC_POSTHOG_HOST,
			flushAt: 1,
			flushInterval: 0
		});
	}
	return posthogClient;
}

function scheduleCapture(capture: Promise<void>) {
	const safeCapture = capture.catch(() => undefined);
	try {
		waitUntil(safeCapture);
	} catch {
		void safeCapture;
	}
}

export function capturePostHogServerEvent(request: Request, event: ServerCaptureEvent) {
	if (!hasAnalyticsConsent(request)) return;

	scheduleCapture(getPostHogClient().captureImmediate(event));
}

/**
 * Capture a privacy-safe operational metric (no user identifiers).
 * Does not require analytics consent — properties must never include PII,
 * question bodies, or user IDs.
 */
export function captureAnonymousServerMetric(event: string, properties?: Record<string, unknown>) {
	scheduleCapture(
		getPostHogClient().captureImmediate({
			distinctId: ANONYMOUS_SERVER_DISTINCT_ID,
			event,
			properties: {
				...properties,
				$process_person_profile: false
			}
		})
	);
}
