import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	isSuperFreeBetaEnabled: vi.fn(),
	findOne: vi.fn(),
	create: vi.fn(),
	exists: vi.fn(),
	insightUpdateMany: vi.fn(),
	neonDatabase: {
		update: vi.fn(() => {
			const query = {
				set: vi.fn(),
				where: vi.fn(),
				returning: vi.fn().mockResolvedValue([{ claimedAt: new Date('2026-08-06T18:00:00.000Z') }])
			};
			query.set.mockReturnValue(query);
			query.where.mockReturnValue(query);
			return query;
		}),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => {
					const query = Promise.resolve([]) as Promise<never[]> & {
						orderBy: ReturnType<typeof vi.fn>;
					};
					query.orderBy = vi.fn().mockResolvedValue([]);
					return query;
				})
			}))
		})),
		delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }))
	}
}));

vi.mock('$lib/server/neon/db', () => ({ getNeonDatabase: () => mocks.neonDatabase }));
vi.mock('$lib/flags', () => ({ isSuperFreeBetaEnabled: mocks.isSuperFreeBetaEnabled }));
vi.mock('$lib/super/models.server', () => ({
	TutorProfile: {
		findOne: mocks.findOne,
		create: mocks.create,
		exists: mocks.exists
	},
	InsightReport: {
		updateMany: mocks.insightUpdateMany
	}
}));

import {
	claimSuperFreeBeta,
	hasClaimedSuperFreeBeta,
	SuperFreeBetaUnavailableError
} from '$lib/super/profile.server';

describe('Super free beta claim', () => {
	const now = new Date('2026-08-06T18:00:00.000Z');

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);
		mocks.exists.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
		mocks.insightUpdateMany.mockReturnValue({ exec: vi.fn().mockResolvedValue({}) });
	});

	it('rejects claims when the free beta flag is off', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
		await expect(claimSuperFreeBeta('student-1', now)).rejects.toBeInstanceOf(
			SuperFreeBetaUnavailableError
		);
	});

	it('persists a free beta claim and starts Super access', async () => {
		const profile = {
			userId: 'student-1',
			superFreeBetaClaimedAt: undefined as Date | undefined,
			superAccessStartedAt: undefined as Date | undefined,
			superEndedAt: undefined,
			memoryPurgedAt: undefined,
			isModified: vi.fn().mockReturnValue(true),
			save: vi.fn().mockResolvedValue(undefined)
		};
		mocks.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(profile) });

		await expect(claimSuperFreeBeta('student-1', now)).resolves.toEqual({
			claimedAt: now.toISOString()
		});
		expect(profile.superFreeBetaClaimedAt).toEqual(now);
		expect(profile.superAccessStartedAt).toEqual(now);
		expect(profile.save).not.toHaveBeenCalled();
		expect(mocks.neonDatabase.update).toHaveBeenCalledTimes(2);
	});

	it('is idempotent when the offer was already claimed', async () => {
		const claimedAt = new Date('2026-08-01T00:00:00.000Z');
		const profile = {
			userId: 'student-1',
			superFreeBetaClaimedAt: claimedAt,
			superAccessStartedAt: claimedAt,
			superEndedAt: undefined,
			memoryPurgedAt: undefined,
			isModified: vi.fn().mockReturnValue(false),
			save: vi.fn().mockResolvedValue(undefined)
		};
		mocks.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(profile) });

		await expect(claimSuperFreeBeta('student-1', now)).resolves.toEqual({
			claimedAt: claimedAt.toISOString()
		});
		expect(profile.save).not.toHaveBeenCalled();
	});

	it('reports whether a user has claimed the free beta offer', async () => {
		mocks.exists.mockReturnValue({
			exec: vi.fn().mockResolvedValue({ _id: 'profile-1' })
		});
		await expect(hasClaimedSuperFreeBeta('student-1')).resolves.toBe(true);

		mocks.exists.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
		await expect(hasClaimedSuperFreeBeta('student-2')).resolves.toBe(false);
	});
});
