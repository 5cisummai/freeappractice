import { describe, expect, it } from 'vitest';
import { getPersonalizedUsageWarning } from '$lib/super/ai-controls.server';

describe('getPersonalizedUsageWarning', () => {
	it('warns at 80% and escalates at 95% of the 600-turn monthly limit', () => {
		expect(getPersonalizedUsageWarning({ used: 479 })).toBeNull();
		expect(getPersonalizedUsageWarning({ used: 480 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 569 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 570 })).toBe(95);
	});
});
