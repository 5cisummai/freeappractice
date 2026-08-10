import { describe, expect, it } from 'vitest';
import { formatDateOnly } from '$lib/date-only';

describe('formatDateOnly', () => {
	it('preserves the calendar day in local time', () => {
		expect(formatDateOnly('2026-08-09', 'en-US')).toBe('8/9/2026');
	});

	it('leaves malformed or impossible values unchanged', () => {
		expect(formatDateOnly('not-a-date', 'en-US')).toBe('not-a-date');
		expect(formatDateOnly('2026-02-30', 'en-US')).toBe('2026-02-30');
	});
});
