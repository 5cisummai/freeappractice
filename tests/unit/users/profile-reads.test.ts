import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));

import { getUserDashboardProfile, getUserProgress, getUserSubjects } from '$lib/users/model.server';

function orderedQuery(rows: unknown[]) {
	return { from: () => ({ where: () => ({ orderBy: async () => rows }) }) };
}

function plainQuery(rows: unknown[]) {
	return { from: () => ({ where: async () => rows }) };
}

describe('focused user profile reads', () => {
	beforeEach(() => vi.clearAllMocks());

	it('reads subjects and progress independently', async () => {
		mocks.select.mockReturnValueOnce(orderedQuery([{ subject: 'AP Biology' }])).mockReturnValueOnce(
			plainQuery([
				{
					apClass: 'AP Biology',
					unit: 'Unit 1',
					completed: false,
					mastery: 75,
					totalAttempts: 8,
					correctAttempts: 6,
					lastAttemptAt: null,
					lastReviewedAt: null
				}
			])
		);

		await expect(getUserSubjects('student-1')).resolves.toEqual(['AP Biology']);
		await expect(getUserProgress('student-1')).resolves.toEqual([
			{
				apClass: 'AP Biology',
				unit: 'Unit 1',
				completed: false,
				mastery: 75,
				totalAttempts: 8,
				correctAttempts: 6,
				lastAttemptAt: undefined,
				lastReviewedAt: undefined
			}
		]);
	});

	it('loads only the small dashboard profile base', async () => {
		const createdAt = new Date('2026-07-01T00:00:00.000Z');
		mocks.select
			.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						limit: async () => [{ createdAt }]
					})
				})
			})
			.mockReturnValueOnce(orderedQuery([{ subject: 'AP Chemistry' }]))
			.mockReturnValueOnce(plainQuery([]));

		const profile = await getUserDashboardProfile('student-1');

		expect(profile).toMatchObject({
			subjects: ['AP Chemistry'],
			progress: [],
			createdAt
		});
	});
});
