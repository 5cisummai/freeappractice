import { describe, expect, it } from 'vitest';
import { isAuthorizedCronRequest } from '$lib/auth/cron-auth';
import { isPasswordWithinLimit } from '$lib/auth/password-policy';

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

describe('password policy', () => {
	it('enforces the 72-byte bcrypt limit for multibyte passwords', () => {
		const withinLimit = '😀'.repeat(18);
		const overLimit = '😀'.repeat(19);

		expect(isPasswordWithinLimit(withinLimit)).toBe(true);
		expect(isPasswordWithinLimit(overLimit)).toBe(false);
	});
});
