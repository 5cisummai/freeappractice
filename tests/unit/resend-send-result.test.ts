import { describe, expect, it } from 'vitest';
import { assertResendSent } from '$lib/auth/resend-result';

describe('assertResendSent', () => {
	it('throws when Resend returns an error payload', () => {
		expect(() =>
			assertResendSent({
				data: null,
				error: {
					message: 'Invalid API key',
					statusCode: 401,
					name: 'validation_error'
				}
			})
		).toThrow('Invalid API key');
	});

	it('throws when Resend returns neither data nor error', () => {
		expect(() => assertResendSent({ data: null, error: null })).toThrow('Failed to send email');
	});

	it('passes when Resend returns a successful send id', () => {
		expect(() =>
			assertResendSent({
				data: { id: 'email_123' },
				error: null
			})
		).not.toThrow();
	});
});
