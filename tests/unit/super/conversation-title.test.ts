import { describe, expect, it } from 'vitest';
import { sanitizeConversationTitle } from '$lib/super/conversations.server';

describe('sanitizeConversationTitle', () => {
	it('strips quotes, trailing periods, and extra whitespace', () => {
		expect(sanitizeConversationTitle('  "AP Calculus review."  ')).toBe('AP Calculus review');
	});

	it('returns null for empty input', () => {
		expect(sanitizeConversationTitle('   ')).toBeNull();
	});
});
