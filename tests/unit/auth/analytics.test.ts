import { describe, expect, it } from 'vitest';
import { classifyAccountCreationMethod } from '$lib/auth/analytics';

describe('classifyAccountCreationMethod', () => {
	it.each([
		['/api/auth/sign-up/email', 'email'],
		['/api/auth/callback/google', 'google'],
		['/api/auth/one-tap/callback', 'google_one_tap'],
		[undefined, 'unknown'],
		['/api/auth/other', 'unknown']
	] as const)('classifies %s as %s', (path, expected) => {
		expect(classifyAccountCreationMethod(path)).toBe(expected);
	});
});
