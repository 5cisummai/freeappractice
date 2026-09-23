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

	it('counts a searched message as five even when search is called twice', async () => {
		const reservation = { month: '2026-09', used: 6, limit: 12, remaining: 6 };
		mocks.reservePersonalizedTurn
			.mockResolvedValueOnce(reservation)
			.mockResolvedValueOnce({ month: '2026-09', used: 10, limit: 12, remaining: 2 });
		const turn = await startPersonalizedTurn('user-1');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		expect(await Promise.all([turn.chargeWebSearch(), turn.chargeWebSearch()])).toEqual([
			true,
			true
		]);
		expect(mocks.reservePersonalizedTurn).toHaveBeenCalledTimes(2);
		expect(mocks.reservePersonalizedTurn).toHaveBeenLastCalledWith('user-1', expect.any(Date), 4);
		await turn.markOutput();
		expect(mocks.rollupPersonalizedUsage).toHaveBeenCalledWith('user-1', {
			month: '2026-09',
			used: 10,
			limit: 12,
			remaining: 2
		});
	});

	it('leaves only the base message charged if four extra units cannot be reserved', async () => {
		mocks.reservePersonalizedTurn
			.mockResolvedValueOnce({ month: '2026-09', used: 9, limit: 10, remaining: 1 })
			.mockResolvedValueOnce(null);
		const turn = await startPersonalizedTurn('user-1');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		await expect(turn.chargeWebSearch()).resolves.toBe(false);
		await turn.markOutput();
		expect(mocks.rollupPersonalizedUsage).toHaveBeenCalledWith('user-1', {
			month: '2026-09',
			used: 9,
			limit: 10,
			remaining: 1
		});
	});

	it('releases all five units when searched output never arrives', async () => {
		mocks.reservePersonalizedTurn
			.mockResolvedValueOnce({ month: '2026-09', used: 1, limit: 10, remaining: 9 })
			.mockResolvedValueOnce({ month: '2026-09', used: 5, limit: 10, remaining: 5 });
		const turn = await startPersonalizedTurn('user-1');
		if (turn.kind !== 'reserved') throw new Error('expected reservation');

		await turn.chargeWebSearch();
		await turn.releaseIfUnused();
		expect(mocks.releasePersonalizedTurn).toHaveBeenCalledWith('user-1', '2026-09', 5);
	});
});
