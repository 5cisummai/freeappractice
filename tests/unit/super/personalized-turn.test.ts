import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageModelUsage } from 'ai';

const mocks = vi.hoisted(() => ({
	limitSuperAi: vi.fn(),
	getPersonalizedUsage: vi.fn(),
	getPersonalizedUsageWarning: vi.fn(),
	chargePersonalizedCredits: vi.fn(),
	rollupPersonalizedUsage: vi.fn()
}));

vi.mock('$lib/super/ai-controls.server', () => mocks);

import { startPersonalizedTurn } from '$lib/super/personalized-turn.server';

function usage(inputTokens: number, outputTokens: number, totalTokens: number): LanguageModelUsage {
	return {
		inputTokens,
		outputTokens,
		totalTokens,
		inputTokenDetails: {
			noCacheTokens: inputTokens,
			cacheReadTokens: 0,
			cacheWriteTokens: 0
		},
		outputTokenDetails: {
			textTokens: outputTokens,
			reasoningTokens: 0
		}
	};
}

describe('personalized turn lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.limitSuperAi.mockResolvedValue({ allowed: true, retryAt: null });
		mocks.getPersonalizedUsageWarning.mockReturnValue(80);
		mocks.chargePersonalizedCredits.mockResolvedValue(5000);
		mocks.rollupPersonalizedUsage.mockResolvedValue(undefined);
	});

	it('charges simulation dollars alongside Coach tokens exactly once', async () => {
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-09',
			used: 0,
			limit: 200_000,
			remaining: 200_000
		});
		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');
		await turn.markOutput(usage(1000, 500, 1500), 0.3);
		await turn.markOutput(usage(1000, 500, 1500), 0.3);
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledOnce();
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledWith(
			'user-1',
			'2026-09',
			7509,
			expect.any(Date)
		);
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
		await turn.markOutput(usage(1000, 500, 1500));
		await turn.markOutput(usage(1, 1, 2));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledTimes(1);
		expect(mocks.rollupPersonalizedUsage).toHaveBeenCalledTimes(1);
	});

	it('adds a web-search surcharge for each recorded successful search', async () => {
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-09',
			used: 0,
			limit: 200_000,
			remaining: 200_000
		});
		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		expect(await turn.chargeWebSearch()).toBe(true);
		turn.recordWebSearch();
		expect(await turn.chargeWebSearch()).toBe(true);
		turn.recordWebSearch();
		await turn.markOutput(usage(0, 0, 0));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledWith(
			'user-1',
			'2026-09',
			500,
			expect.any(Date)
		);
	});

	it('does not charge a web search that was approved but not recorded', async () => {
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-09',
			used: 0,
			limit: 200_000,
			remaining: 200_000
		});
		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		expect(await turn.chargeWebSearch()).toBe(true);
		await turn.markOutput(usage(0, 0, 0));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledWith(
			'user-1',
			'2026-09',
			0,
			expect.any(Date)
		);
	});

	it('rejects web search when fewer than 0.25 credits remain', async () => {
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-09',
			used: 199_900,
			limit: 200_000,
			remaining: 100
		});
		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		await expect(turn.chargeWebSearch()).resolves.toBe(false);
		await turn.markOutput(usage(100, 50, 150));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalled();
		const chargedMilli = mocks.chargePersonalizedCredits.mock.calls[0]?.[2] as number;
		expect(chargedMilli).toBeLessThan(250);
	});

	it('allows markOutput to retry after a failed charge', async () => {
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-09',
			used: 0,
			limit: 200_000,
			remaining: 200_000
		});
		mocks.chargePersonalizedCredits
			.mockRejectedValueOnce(new Error('redis down'))
			.mockResolvedValueOnce(250);
		const turn = await startPersonalizedTurn('user-1', 'subscription');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		await expect(turn.markOutput(usage(0, 0, 0))).rejects.toThrow('redis down');
		await turn.markOutput(usage(0, 0, 0));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledTimes(2);
	});
});
