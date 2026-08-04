import type { AnalyticsConsent } from '$lib/analytics-consent';

export type PostHogOperationKind = 'capture' | 'identify' | 'pageview' | 'exception';
export type PostHogOperationDisposition = 'queue' | 'send' | 'drop';

export function getPostHogOperationDisposition(
	consent: AnalyticsConsent,
	kind: PostHogOperationKind
): PostHogOperationDisposition {
	if (consent === 'granted') return 'send';
	if (consent === 'denied') return kind === 'pageview' ? 'send' : 'drop';
	return kind === 'pageview' || kind === 'exception' ? 'drop' : 'queue';
}
