import { describe, expect, it } from 'vitest';
import { ANALYTICS_CONSENT_KEY } from '$lib/analytics-consent';
import { hasAnalyticsConsent } from '$lib/server/analytics-consent';

describe('hasAnalyticsConsent', () => {
	it('returns false without a consent cookie', () => {
		expect(hasAnalyticsConsent(new Request('https://example.com'))).toBe(false);
		expect(
			hasAnalyticsConsent(
				new Request('https://example.com', {
					headers: { cookie: 'other=1' }
				})
			)
		).toBe(false);
	});

	it('returns true only when consent is granted', () => {
		expect(
			hasAnalyticsConsent(
				new Request('https://example.com', {
					headers: { cookie: `${ANALYTICS_CONSENT_KEY}=denied` }
				})
			)
		).toBe(false);
		expect(
			hasAnalyticsConsent(
				new Request('https://example.com', {
					headers: { cookie: `foo=1; ${ANALYTICS_CONSENT_KEY}=granted; bar=2` }
				})
			)
		).toBe(true);
	});
});
