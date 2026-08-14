import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));
vi.mock('$lib/ai/service.server', () => ({ structuredObject: vi.fn() }));
vi.mock('$lib/question-bank/frq/profiles.server', () => ({ getFrqCourseProfile: vi.fn() }));
vi.mock('$lib/question-bank/frq/model.server', () => ({ getFrqQuestionById: vi.fn() }));
vi.mock('$lib/server/logger', () => ({ logger: { error: vi.fn() } }));

import { getFrqProgressForUser } from '$lib/grading/frq/attempts.server';

function progressQuery(rows: unknown[]) {
	return {
		from: () => ({
			innerJoin: () => ({
				where: () => ({ groupBy: async () => rows })
			})
		})
	};
}

describe('FRQ dashboard queries', () => {
	beforeEach(() => vi.clearAllMocks());

	it('maps grouped SQL totals and handles zero available points', async () => {
		mocks.select.mockReturnValueOnce(
			progressQuery([
				{
					apClass: 'AP Biology',
					unit: 'Unit 2',
					attempts: '3',
					pointsEarned: '7',
					pointsAvailable: '10',
					lastAttemptAt: new Date('2026-08-01T00:00:00.000Z')
				},
				{
					apClass: 'AP Biology',
					unit: 'Unit 3',
					attempts: '1',
					pointsEarned: '0',
					pointsAvailable: '0',
					lastAttemptAt: null
				}
			])
		);

		await expect(getFrqProgressForUser('student-1')).resolves.toEqual([
			{
				apClass: 'AP Biology',
				unit: 'Unit 2',
				attempts: 3,
				pointsEarned: 7,
				pointsAvailable: 10,
				averagePercentage: 70,
				lastAttemptAt: '2026-08-01T00:00:00.000Z'
			},
			{
				apClass: 'AP Biology',
				unit: 'Unit 3',
				attempts: 1,
				pointsEarned: 0,
				pointsAvailable: 0,
				averagePercentage: 0,
				lastAttemptAt: undefined
			}
		]);
	});
});
