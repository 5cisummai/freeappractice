import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ isSuperFreeBetaEnabled: vi.fn() }));

vi.mock('$lib/flags', () => ({ isSuperFreeBetaEnabled: mocks.isSuperFreeBetaEnabled }));

import {
	getPersonalizedUsageWarning,
	getSuperMonthlyMessageLimit
} from '$lib/super/ai-controls.server';

describe('getPersonalizedUsageWarning', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
	});

	it('warns at 80% and escalates at 95% of the 1,000-turn monthly limit', () => {
		expect(getPersonalizedUsageWarning({ used: 799 })).toBeNull();
		expect(getPersonalizedUsageWarning({ used: 800 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 949 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 950 })).toBe(95);
	});

	it('uses the 500-turn beta limit when provided', () => {
		expect(getPersonalizedUsageWarning({ used: 399, limit: 500 })).toBeNull();
		expect(getPersonalizedUsageWarning({ used: 400, limit: 500 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 475, limit: 500 })).toBe(95);
	});

	it('selects the beta limit only while the beta flag is on', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);
		await expect(getSuperMonthlyMessageLimit()).resolves.toBe(500);

		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
		await expect(getSuperMonthlyMessageLimit()).resolves.toBe(1000);
	});
});
