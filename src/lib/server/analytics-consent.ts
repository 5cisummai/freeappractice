import { ANALYTICS_CONSENT_KEY } from '#lib/analytics-consent.js';

export function hasAnalyticsConsent(request: Request): boolean {
	const cookieHeader = request.headers.get('cookie');
	if (!cookieHeader) return false;

	const match = cookieHeader.match(new RegExp(`${ANALYTICS_CONSENT_KEY}=([^;]+)`));
	return match?.[1] === 'granted';
}
