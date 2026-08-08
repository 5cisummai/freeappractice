import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateOne, findOneAndUpdate, countActivePoolRows } = vi.hoisted(() => ({
	updateOne: vi.fn(),
	findOneAndUpdate: vi.fn(),
	countActivePoolRows: vi.fn()
}));

vi.mock('$env/static/private', () => ({ DATABASE_URI: 'mongodb://localhost/test' }));
vi.mock('$lib/server/db', () => ({ connectDb: vi.fn(async () => ({})) }));
vi.mock('$lib/questions/pool-refill-model.server', () => ({
	PoolBucketWriteLock: { updateOne, findOneAndUpdate }
}));
vi.mock('$lib/questions/pool-refill-queue.server', () => ({ countActivePoolRows }));

import { writePoolBucketBelowTarget } from '$lib/questions/pool-capacity.server';

const bucket = { questionType: 'mcq' as const, apClass: 'AP Biology', unit: 'Unit 1' };

describe('writePoolBucketBelowTarget', () => {
	beforeEach(() => {
		updateOne.mockReset();
		findOneAndUpdate.mockReset();
		countActivePoolRows.mockReset();
		updateOne.mockReturnValue({ exec: async () => ({}) });
		findOneAndUpdate.mockReturnValue({ exec: async () => ({ leaseOwner: 'owner' }) });
	});

	it('holds a per-bucket lease around the final target check and write', async () => {
		countActivePoolRows.mockResolvedValue(19);
		const write = vi.fn(async () => 'inserted');

		await expect(writePoolBucketBelowTarget(bucket, 20, write)).resolves.toEqual({
			status: 'written',
			value: 'inserted'
		});
		expect(write).toHaveBeenCalledOnce();
		expect(findOneAndUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				questionType: 'mcq',
				apClass: 'AP Biology',
				unit: 'Unit 1',
				$or: expect.arrayContaining([
					{ leaseOwner: null },
					{ leaseExpiresAt: { $lte: expect.any(Date) } }
				])
			}),
			expect.anything(),
			{ returnDocument: 'after' }
		);
	});

	it('does not write after a concurrent writer fills the final slot', async () => {
		countActivePoolRows.mockResolvedValue(20);
		const write = vi.fn(async () => 'should-not-run');

		await expect(writePoolBucketBelowTarget(bucket, 20, write)).resolves.toEqual({
			status: 'at_target',
			activeCount: 20
		});
		expect(write).not.toHaveBeenCalled();
		expect(updateOne).toHaveBeenCalledTimes(2);
	});
});
