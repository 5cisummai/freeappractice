import { describe, expect, it } from 'vitest';
import {
	isAnonymousMcqFetch,
	isEmailDeliveryStatus,
	isResendWebhook,
	shouldSkipGlobalApiRateLimit,
	shouldSkipSessionLookup
} from '$lib/server/request-policy.server';

describe('request policy', () => {
	it('treats anonymous MCQ fetch as one hot path', () => {
		expect(isAnonymousMcqFetch('POST', '/api/question')).toBe(true);
		expect(shouldSkipSessionLookup('POST', '/api/question')).toBe(true);
		expect(shouldSkipGlobalApiRateLimit('POST', '/api/question')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/api/question')).toBe(false);
		expect(shouldSkipGlobalApiRateLimit('POST', '/api/question/feedback')).toBe(false);
	});

	it('exempts the Resend webhook from session and global API policy', () => {
		expect(isResendWebhook('POST', '/api/webhooks/resend')).toBe(true);
		expect(shouldSkipSessionLookup('POST', '/api/webhooks/resend')).toBe(true);
		expect(shouldSkipGlobalApiRateLimit('POST', '/api/webhooks/resend')).toBe(true);
		expect(isResendWebhook('GET', '/api/webhooks/resend')).toBe(false);
		expect(shouldSkipGlobalApiRateLimit('POST', '/api/webhooks/resend/')).toBe(false);
	});

	it('skips session lookup for an opaque email delivery status ID', () => {
		expect(
			isEmailDeliveryStatus('GET', '/api/email-delivery/123e4567-e89b-12d3-a456-426614174000')
		).toBe(true);
		expect(
			shouldSkipSessionLookup('GET', '/api/email-delivery/123e4567-e89b-12d3-a456-426614174000')
		).toBe(true);
		expect(shouldSkipGlobalApiRateLimit('GET', '/api/email-delivery/not-a-uuid')).toBe(false);
	});

	it('skips session lookup for public marketing GET routes', () => {
		expect(shouldSkipSessionLookup('GET', '/')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/practice/ap-biology')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/blog')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/blog/ap-biology-tips')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/pricing')).toBe(true);
		expect(shouldSkipSessionLookup('GET', '/app')).toBe(false);
		expect(shouldSkipSessionLookup('GET', '/login')).toBe(false);
	});
});
