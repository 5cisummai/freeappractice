import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPT_TIME_MS, sanitizeAttemptTimeMs } from '$lib/users/attempt-time';

describe('sanitizeAttemptTimeMs', () => {
	it('returns 0 for non-finite or negative values', () => {
		expect(sanitizeAttemptTimeMs(undefined)).toBe(0);
		expect(sanitizeAttemptTimeMs(null)).toBe(0);
		expect(sanitizeAttemptTimeMs('12')).toBe(0);
		expect(sanitizeAttemptTimeMs(Number.NaN)).toBe(0);
		expect(sanitizeAttemptTimeMs(-5)).toBe(0);
	});

	it('rounds and clamps to the max attempt duration', () => {
		expect(sanitizeAttemptTimeMs(1500.7)).toBe(1501);
		expect(sanitizeAttemptTimeMs(MAX_ATTEMPT_TIME_MS + 10_000)).toBe(MAX_ATTEMPT_TIME_MS);
	});
});
