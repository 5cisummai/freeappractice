import { describe, expect, it } from 'vitest';
import {
	TIMEZONE_COOKIE_NAME,
	parseTimezone,
	timezoneFromCookies,
	timezoneFromRequest
} from '#lib/users/timezone.js';

describe('parseTimezone', () => {
	it('accepts valid IANA timezones and rejects invalid values', () => {
		expect(parseTimezone('America/Los_Angeles')).toBe('America/Los_Angeles');
		expect(parseTimezone('  UTC  ')).toBe('UTC');
		expect(parseTimezone(encodeURIComponent('Europe/Paris'))).toBe('Europe/Paris');
		expect(parseTimezone(undefined)).toBeUndefined();
		expect(parseTimezone('')).toBeUndefined();
		expect(parseTimezone('Not/A_Zone')).toBeUndefined();
		expect(parseTimezone('x'.repeat(65))).toBeUndefined();
		expect(parseTimezone('%E0%A4%A')).toBeUndefined();
	});
});

describe('timezoneFromCookies', () => {
	it('reads the timezone cookie', () => {
		expect(
			timezoneFromCookies({
				get: (name) => (name === TIMEZONE_COOKIE_NAME ? 'America/New_York' : undefined)
			})
		).toBe('America/New_York');
		expect(timezoneFromCookies({ get: () => undefined })).toBeUndefined();
	});
});

describe('timezoneFromRequest', () => {
	it('prefers the x-timezone header over the cookie', () => {
		const request = new Request('https://example.com', {
			headers: { 'x-timezone': 'America/Los_Angeles' }
		});
		expect(
			timezoneFromRequest(request, {
				get: (name) => (name === TIMEZONE_COOKIE_NAME ? 'America/New_York' : undefined)
			})
		).toBe('America/Los_Angeles');
	});
});
