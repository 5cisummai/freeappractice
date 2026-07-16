import { describe, expect, it } from 'vitest';
import {
	TIMEZONE_COOKIE_NAME,
	parseTimezone,
	timezoneFromCookies
} from '$lib/users/timezone';

describe('parseTimezone', () => {
	it('accepts valid IANA timezones', () => {
		expect(parseTimezone('America/Los_Angeles')).toBe('America/Los_Angeles');
		expect(parseTimezone('  UTC  ')).toBe('UTC');
		expect(parseTimezone(encodeURIComponent('Europe/Paris'))).toBe('Europe/Paris');
	});

	it('rejects missing, oversized, or invalid values', () => {
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
