import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	limitSuperAi: vi.fn(),
	getPersonalizedUsage: vi.fn(),
	getPersonalizedUsageWarning: vi.fn(),
	chargePersonalizedCredits: vi.fn(),
	rollupPersonalizedUsage: vi.fn()
}));

vi.mock('$lib/super/ai-controls.server', () => mocks);

import { startPersonalizedTurn } from '$lib/super/personalized-turn.server';

describe('personalized turn lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.limitSuperAi.mockResolvedValue({ allowed: true, retryAt: null });
		mocks.getPersonalizedUsageWarning.mockReturnValue(80);
		mocks.chargePersonalizedCredits.mockResolvedValue(5000);
		mocks.rollupPersonalizedUsage.mockResolvedValue(undefined);
	});

	it('rate-limits before reading usage', async () => {
		mocks.limitSuperAi.mockResolvedValue({ allowed: false, retryAt: 123 });

		await expect(startPersonalizedTurn('user-1', 'subscription')).resolves.toEqual({
			kind: 'rate-limited',
			retryAt: 123
		});
		expect(mocks.getPersonalizedUsage).not.toHaveBeenCalled();
	});

	it('returns quota exhaustion when at the monthly credit cap', async () => {
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-08',
			used: 200_000,
			limit: 200_000,
			remaining: 0
		});

		await expect(startPersonalizedTurn('user-1', 'subscription')).resolves.toEqual({
			kind: 'exhausted'
		});
		expect(mocks.getPersonalizedUsageWarning).not.toHaveBeenCalled();
	});

	it('computes the warning once and charges usage exactly once', async () => {
		const reservation = { month: '2026-08', used: 160_000, limit: 200_000, remaining: 40_000 };
		mocks.getPersonalizedUsage.mockResolvedValue(reservation);

		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		expect(turn.usageWarning).toBe(80);
		expect(mocks.getPersonalizedUsageWarning).toHaveBeenCalledTimes(1);
		await turn.markOutput({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500 });
		await turn.markOutput({ inputTokens: 1, outputTokens: 1, totalTokens: 2 });
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledTimes(1);
		expect(mocks.rollupPersonalizedUsage).toHaveBeenCalledTimes(1);
	});

	it('adds the web-search surcharge when search was allowed', async () => {
		mocks.getPersonalizedUsage
			.mockResolvedValueOnce({ month: '2026-09', used: 0, limit: 200_000, remaining: 200_000 })
			.mockResolvedValueOnce({ month: '2026-09', used: 0, limit: 200_000, remaining: 200_000 });
		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		expect(await Promise.all([turn.chargeWebSearch(), turn.chargeWebSearch()])).toEqual([
			true,
			true
		]);
		await turn.markOutput({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledWith(
			'user-1',
			'2026-09',
			250,
			expect.any(Date)
		);
	});

	it('rejects web search when fewer than 0.25 credits remain', async () => {
		mocks.getPersonalizedUsage
			.mockResolvedValueOnce({ month: '2026-09', used: 199_900, limit: 200_000, remaining: 100 })
			.mockResolvedValueOnce({ month: '2026-09', used: 199_900, limit: 200_000, remaining: 100 });
		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		await expect(turn.chargeWebSearch()).resolves.toBe(false);
		await turn.markOutput({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalled();
		const chargedMilli = mocks.chargePersonalizedCredits.mock.calls[0]?.[2] as number;
		expect(chargedMilli).toBeLessThan(250);
	});
});
