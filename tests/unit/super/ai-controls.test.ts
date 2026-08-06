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

	it('warns at 80% and escalates at 95% of the 600-turn monthly limit', () => {
		expect(getPersonalizedUsageWarning({ used: 479 })).toBeNull();
		expect(getPersonalizedUsageWarning({ used: 480 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 569 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 570 })).toBe(95);
	});

	it('uses the 300-turn beta limit when provided', () => {
		expect(getPersonalizedUsageWarning({ used: 239, limit: 300 })).toBeNull();
		expect(getPersonalizedUsageWarning({ used: 240, limit: 300 })).toBe(80);
		expect(getPersonalizedUsageWarning({ used: 285, limit: 300 })).toBe(95);
	});

	it('selects the beta limit only while the beta flag is on', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);
		await expect(getSuperMonthlyMessageLimit()).resolves.toBe(300);

		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
		await expect(getSuperMonthlyMessageLimit()).resolves.toBe(600);
	});
});
