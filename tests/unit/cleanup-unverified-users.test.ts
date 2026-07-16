import { describe, expect, it } from 'vitest';
import {
	isAuthorizedCronRequest,
	unverifiedUserCutoff,
	UNVERIFIED_USER_MAX_AGE_MS
} from '$lib/auth/cron-auth';

describe('isAuthorizedCronRequest', () => {
	it('rejects when CRON_SECRET is missing', () => {
		const request = new Request('https://example.com/api/cron', {
			headers: { authorization: 'Bearer secret' }
		});
		expect(isAuthorizedCronRequest(request, undefined)).toBe(false);
	});

	it('rejects wrong bearer token', () => {
		const request = new Request('https://example.com/api/cron', {
			headers: { authorization: 'Bearer wrong' }
		});
		expect(isAuthorizedCronRequest(request, 'correct-secret')).toBe(false);
	});

	it('accepts matching bearer token', () => {
		const secret = 'correct-secret-value';
		const request = new Request('https://example.com/api/cron', {
			headers: { authorization: `Bearer ${secret}` }
		});
		expect(isAuthorizedCronRequest(request, secret)).toBe(true);
	});
});

describe('unverifiedUserCutoff', () => {
	it('is three days before now', () => {
		const now = new Date('2026-07-16T00:00:00.000Z');
		expect(unverifiedUserCutoff(now).toISOString()).toBe(
			new Date(now.getTime() - UNVERIFIED_USER_MAX_AGE_MS).toISOString()
		);
	});
});
