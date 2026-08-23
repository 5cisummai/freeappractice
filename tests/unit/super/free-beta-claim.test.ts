/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tutorProfiles } from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => ({
	isSuperFreeBetaEnabled: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
	claimed: false
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select, update: mocks.update })
}));
vi.mock('$lib/flags', () => ({ isSuperFreeBetaEnabled: mocks.isSuperFreeBetaEnabled }));

import {
	claimSuperFreeBeta,
	hasClaimedSuperFreeBeta,
	SuperFreeBetaUnavailableError
} from '$lib/super/profile.server';

const now = new Date('2026-08-06T18:00:00.000Z');

function profile() {
	return {
		userId: 'student-1',
		ageConfirmedAt: null,
		mem0UserId: 'memory-1',
		selectedApClasses: [],
		targetDates: [],
		studyAvailability: '',
		teachingStyle: 'socratic',
		memoryEnabled: true,
		memoryDisclosureSeenAt: null,
		superFreeBetaClaimedAt: mocks.claimed ? now : null,
		superAccessStartedAt: mocks.claimed ? now : null,
		superEndedAt: null,
		memoryPurgedAt: null,
		createdAt: now,
		updatedAt: now
	};
}

function chain(table: unknown) {
	const value: any = {
		from: vi.fn(() => value),
		where: vi.fn(() => value),
		orderBy: vi.fn(() => value),
		limit: vi.fn(async () => (table === tutorProfiles ? [profile()] : [])),
		then: (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
			Promise.resolve(table === tutorProfiles ? [profile()] : []).then(resolve, reject)
	};
	return value;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.claimed = false;
	mocks.isSuperFreeBetaEnabled.mockResolvedValue(true);
	mocks.select.mockImplementation(() => {
		const value: any = {
			from: (table: unknown) => chain(table)
		};
		return value;
	});
	mocks.update.mockImplementation(() => {
		const value: any = {
			set: vi.fn(() => value),
			where: vi.fn(() => value),
			returning: vi.fn(async () => [{ claimedAt: now }]),
			then: (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
				Promise.resolve([{ claimedAt: now }]).then(resolve, reject)
		};
		return value;
	});
});

describe('Super free beta claim', () => {
	it('rejects claims when the feature is disabled', async () => {
		mocks.isSuperFreeBetaEnabled.mockResolvedValue(false);
		await expect(claimSuperFreeBeta('student-1', now)).rejects.toBeInstanceOf(
			SuperFreeBetaUnavailableError
		);
	});

	it('persists a claim through direct Drizzle updates', async () => {
		await expect(claimSuperFreeBeta('student-1', now)).resolves.toEqual({
			claimedAt: now.toISOString()
		});
		expect(mocks.update).toHaveBeenCalled();
	});

	it('reads the claim from the profile table', async () => {
		mocks.claimed = true;
		expect(await hasClaimedSuperFreeBeta('student-1')).toBe(true);
		expect(mocks.select).toHaveBeenCalled();
	});
});
