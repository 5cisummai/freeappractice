import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageModelUsage } from 'ai';

const mocks = vi.hoisted(() => ({
	limitSuperAi: vi.fn(),
	getPersonalizedUsage: vi.fn(),
	getPersonalizedUsageWarning: vi.fn(),
	chargePersonalizedCredits: vi.fn(),
	rollupPersonalizedUsage: vi.fn()
}));

vi.mock('$lib/agent/usage/controls.server', () => mocks);

import { startAgentTurn } from '$lib/agent/usage/turn.server';

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
		const turn = await startAgentTurn('user-1', 'subscription');
		if (turn.kind !== 'available') throw new Error('expected usage');
		await turn.chargeUsage(usage(1000, 500, 1500), 0.3);
		await turn.chargeUsage(usage(1000, 500, 1500), 0.3);
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

		await expect(startAgentTurn('user-1', 'subscription')).resolves.toEqual({
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

		await expect(startAgentTurn('user-1', 'subscription')).resolves.toEqual({
			kind: 'exhausted'
		});
		expect(mocks.getPersonalizedUsageWarning).not.toHaveBeenCalled();
	});

	it('computes the warning once and charges usage exactly once', async () => {
		const snapshot = { month: '2026-08', used: 160_000, limit: 200_000, remaining: 40_000 };
		mocks.getPersonalizedUsage.mockResolvedValue(snapshot);

		const turn = await startAgentTurn('user-1', 'subscription');
		if (turn.kind !== 'available') throw new Error('expected usage');

		expect(turn.usageWarning).toBe(80);
		expect(mocks.getPersonalizedUsageWarning).toHaveBeenCalledTimes(1);
		await turn.chargeUsage(usage(1000, 500, 1500));
		await turn.chargeUsage(usage(1, 1, 2));
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
		const turn = await startAgentTurn('user-1', 'subscription');
		if (turn.kind !== 'available') throw new Error('expected usage');

		expect(await turn.canAffordWebSearch()).toBe(true);
		turn.recordWebSearch();
		expect(await turn.canAffordWebSearch()).toBe(true);
		turn.recordWebSearch();
		await turn.chargeUsage(usage(0, 0, 0));
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
		const turn = await startAgentTurn('user-1', 'subscription');
		if (turn.kind !== 'available') throw new Error('expected usage');

		expect(await turn.canAffordWebSearch()).toBe(true);
		await turn.chargeUsage(usage(0, 0, 0));
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
		const turn = await startAgentTurn('user-1', 'subscription');
		if (turn.kind !== 'available') throw new Error('expected usage');

		await expect(turn.canAffordWebSearch()).resolves.toBe(false);
		await turn.chargeUsage(usage(100, 50, 150));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalled();
		const chargedMilli = mocks.chargePersonalizedCredits.mock.calls[0]?.[2] as number;
		expect(chargedMilli).toBeLessThan(250);
	});

	it('allows chargeUsage to retry after a failed charge', async () => {
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-09',
			used: 0,
			limit: 200_000,
			remaining: 200_000
		});
		mocks.chargePersonalizedCredits
			.mockRejectedValueOnce(new Error('redis down'))
			.mockResolvedValueOnce(250);
		const turn = await startAgentTurn('user-1', 'subscription');
		if (turn.kind !== 'available') throw new Error('expected usage');

		await expect(turn.chargeUsage(usage(0, 0, 0))).rejects.toThrow('redis down');
		await turn.chargeUsage(usage(0, 0, 0));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledTimes(2);
	});
});

describe('usage rollup retries', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.limitSuperAi.mockResolvedValue({ allowed: true, retryAt: null });
		mocks.getPersonalizedUsage.mockResolvedValue({
			month: '2026-09',
			used: 0,
			limit: 200000,
			remaining: 200000
		});
		mocks.chargePersonalizedCredits.mockResolvedValue(5000);
		mocks.rollupPersonalizedUsage.mockResolvedValue(undefined);
	});
	it('does not charge tokens again when only the SQL rollup failed', async () => {
		mocks.rollupPersonalizedUsage.mockRejectedValueOnce(new Error('SQL unavailable'));
		const turn = await startAgentTurn('user-1', 'subscription');
		if (turn.kind !== 'available') throw new Error('expected usage');
		await expect(turn.chargeUsage(usage(100, 50, 150))).rejects.toThrow('SQL unavailable');
		await turn.chargeUsage(usage(100, 50, 150));
		expect(mocks.chargePersonalizedCredits).toHaveBeenCalledOnce();
		expect(mocks.rollupPersonalizedUsage).toHaveBeenCalledTimes(2);
	});
});
