import { describe, expect, it } from 'vitest';
import { parseHistoryKind, parseHistoryResult, parseHistorySort } from '$lib/users/history.server';

describe('history query parameter parsing', () => {
	it('defaults to attemptedAt desc and accepts supported sort fields', () => {
		expect(parseHistorySort(null, null)).toEqual({
			field: 'attemptedAt',
			direction: 'desc'
		});
		expect(parseHistorySort('subject', 'asc')).toEqual({
			field: 'subject',
			direction: 'asc'
		});
		expect(parseHistorySort('result', 'desc')).toEqual({
			field: 'result',
			direction: 'desc'
		});
		expect(parseHistorySort('nope', 'asc').field).toBe('attemptedAt');
	});

	it('accepts only supported result and source filters', () => {
		expect(parseHistoryResult('correct')).toBe('correct');
		expect(parseHistoryResult('incorrect')).toBe('incorrect');
		expect(parseHistoryResult('other')).toBeUndefined();
		expect(parseHistoryKind('mcq')).toBe('mcq');
		expect(parseHistoryKind('frq')).toBe('frq');
		expect(parseHistoryKind('other')).toBeUndefined();
	});
});
