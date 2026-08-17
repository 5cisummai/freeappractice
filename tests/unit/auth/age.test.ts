import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAtLeastAge, isValidBirthDate } from '$lib/auth/age';

describe('age validation', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('allows the local date one day ahead of UTC today', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z'));

		expect(isValidBirthDate('2026-08-17')).toBe(true);
		expect(isAtLeastAge('2013-08-17')).toBe(true);
		expect(isValidBirthDate('2026-08-18')).toBe(false);
	});
});
