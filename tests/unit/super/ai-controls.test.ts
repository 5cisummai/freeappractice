import { describe, expect, it } from 'vitest';
import { getPersonalizedUsageWarning } from '$lib/super/ai-controls.server';
import {
	SUPER_FREE_BETA_MONTHLY_CREDITS_MILLI,
	SUPER_MONTHLY_CREDITS_MILLI
} from '$lib/super/usage-credits';
import { monthlyCreditLimitMilli } from '$lib/super/usage-credits';

describe('getPersonalizedUsageWarning', () => {
	it('warns at 80% and escalates at 95% of the Super monthly credit cap', () => {
		const limit = SUPER_MONTHLY_CREDITS_MILLI;
		expect(getPersonalizedUsageWarning({ used: limit * 0.8 - 1 })).toBeNull();
		expect(getPersonalizedUsageWarning({ used: limit * 0.8 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: limit * 0.95 - 1 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: limit * 0.95 })).toBe(95);
	});

	it('uses the free-beta cap when provided', () => {
		const limit = SUPER_FREE_BETA_MONTHLY_CREDITS_MILLI;
		expect(getPersonalizedUsageWarning({ used: limit * 0.8 - 1, limit })).toBeNull();
		expect(getPersonalizedUsageWarning({ used: limit * 0.8, limit })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: limit * 0.95, limit })).toBe(95);
	});
});

describe('monthlyCreditLimitMilli', () => {
	it('maps free beta to 50 credits and paid Super to 200 credits', () => {
		expect(monthlyCreditLimitMilli('free_beta')).toBe(50_000);
		expect(monthlyCreditLimitMilli('subscription')).toBe(SUPER_MONTHLY_CREDITS_MILLI);
	});
});
