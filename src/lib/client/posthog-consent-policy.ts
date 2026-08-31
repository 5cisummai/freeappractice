import type { AnalyticsConsent } from '$lib/analytics-consent';

export type PostHogOperationKind = 'capture' | 'identify' | 'pageview' | 'pageleave' | 'exception';
export type PostHogOperationDisposition = 'queue' | 'send' | 'drop';

export function getPostHogOperationDisposition(
	consent: AnalyticsConsent,
	kind: PostHogOperationKind
): PostHogOperationDisposition {
	if (consent === 'granted') return 'send';
	// Aggregate page traffic always flows cookieless (on_reject / pending / denied).
	if (kind === 'pageview' || kind === 'pageleave') return 'send';
	if (consent === 'denied') return 'drop';
	// Undecided: queue product events until Accept; drop exceptions (no PII risk from queueing).
	return kind === 'exception' ? 'drop' : 'queue';
}
