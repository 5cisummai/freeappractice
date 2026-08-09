import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	limitSuperAi: vi.fn(),
	reservePersonalizedTurn: vi.fn(),
	getPersonalizedUsageWarning: vi.fn(),
	rollupPersonalizedUsage: vi.fn(),
	releasePersonalizedTurn: vi.fn()
}));

vi.mock('$lib/super/ai-controls.server', () => mocks);

import { startPersonalizedTurn } from '$lib/super/personalized-turn.server';

describe('personalized turn lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.limitSuperAi.mockResolvedValue({ allowed: true, retryAt: null });
		mocks.getPersonalizedUsageWarning.mockReturnValue(80);
		mocks.rollupPersonalizedUsage.mockResolvedValue(undefined);
		mocks.releasePersonalizedTurn.mockResolvedValue(undefined);
	});

	it('rate-limits before reserving', async () => {
		mocks.limitSuperAi.mockResolvedValue({ allowed: false, retryAt: 123 });

		await expect(startPersonalizedTurn('user-1')).resolves.toEqual({
			kind: 'rate-limited',
			retryAt: 123
		});
		expect(mocks.reservePersonalizedTurn).not.toHaveBeenCalled();
	});

	it('returns quota exhaustion without creating a lifecycle', async () => {
		mocks.reservePersonalizedTurn.mockResolvedValue(null);

		await expect(startPersonalizedTurn('user-1')).resolves.toEqual({ kind: 'exhausted' });
		expect(mocks.getPersonalizedUsageWarning).not.toHaveBeenCalled();
	});

	it('computes the warning once and rolls up or releases exactly once', async () => {
		const reservation = { month: '2026-08', used: 8, limit: 10, remaining: 2 };
		mocks.reservePersonalizedTurn.mockResolvedValue(reservation);

		const turn = await startPersonalizedTurn('user-1');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		expect(turn.usageWarning).toBe(80);
		expect(mocks.getPersonalizedUsageWarning).toHaveBeenCalledTimes(1);
		await turn.markOutput();
		await turn.markOutput();
		await turn.releaseIfUnused();
		expect(mocks.rollupPersonalizedUsage).toHaveBeenCalledTimes(1);
		expect(mocks.releasePersonalizedTurn).not.toHaveBeenCalled();

		const secondTurn = await startPersonalizedTurn('user-1');
		if (secondTurn.kind !== 'reserved') throw new Error('expected reservation');
		await secondTurn.releaseIfUnused();
		await secondTurn.releaseIfUnused();
		expect(mocks.releasePersonalizedTurn).toHaveBeenCalledTimes(1);
	});
});
