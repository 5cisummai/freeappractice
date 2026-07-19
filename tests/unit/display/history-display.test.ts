import { describe, expect, it } from 'vitest';
import { formatTimeTaken } from '$lib/history-display';

describe('formatTimeTaken', () => {
	it('formats seconds and minutes', () => {
		expect(formatTimeTaken(1_000)).toBe('1s');
		expect(formatTimeTaken(90_000)).toBe('1m 30s');
	});
});
