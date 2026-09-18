import { matchesPublicMarketingPath } from '$lib/routes/public-marketing';
import { isEmailDeliveryId } from '$lib/auth/email-delivery';

const RESEND_WEBHOOK_PATH = '/api/webhooks/resend';
const EMAIL_DELIVERY_STATUS_PREFIX = '/api/email-delivery/';

/** Hot anonymous MCQ pool fetches — skip session lookup and global Redis rate limiting. */
export function isAnonymousMcqFetch(method: string, pathname: string): boolean {
	return method === 'POST' && (pathname === '/api/question' || pathname === '/api/questions/batch');
}

/** Resend cannot provide an app session, and webhook retries must not be rate limited. */
export function isResendWebhook(method: string, pathname: string): boolean {
	return method === 'POST' && pathname === RESEND_WEBHOOK_PATH;
}

export function isEmailDeliveryStatus(method: string, pathname: string): boolean {
	return (
		method === 'GET' &&
		pathname.startsWith(EMAIL_DELIVERY_STATUS_PREFIX) &&
		isEmailDeliveryId(pathname.slice(EMAIL_DELIVERY_STATUS_PREFIX.length))
	);
}

export function shouldSkipSessionLookup(method: string, pathname: string): boolean {
	if (
		isAnonymousMcqFetch(method, pathname) ||
		isResendWebhook(method, pathname) ||
		isEmailDeliveryStatus(method, pathname)
	)
		return true;
	return method === 'GET' && matchesPublicMarketingPath(pathname);
}

export function shouldSkipGlobalApiRateLimit(method: string, pathname: string): boolean {
	return isAnonymousMcqFetch(method, pathname) || isResendWebhook(method, pathname);
}
