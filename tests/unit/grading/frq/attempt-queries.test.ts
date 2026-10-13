import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({ select: mocks.select })
}));
vi.mock('ai', async (load) => ({ ...(await load<typeof import('ai')>()), generateText: vi.fn() }));
vi.mock('#lib/question-bank/frq/profiles.server.js', () => ({ getFrqCourseProfile: vi.fn() }));
vi.mock('#lib/question-bank/frq/model.server.js', () => ({ getFrqQuestionById: vi.fn() }));
vi.mock('#lib/server/logger.js', () => ({ logger: { error: vi.fn() } }));

import { getFrqProgressForUser } from '#lib/grading/frq/attempts.server.js';

function progressQuery(rows: unknown[]) {
	return {
		from: () => ({
			where: () => ({ groupBy: async () => rows })
		})
	};
}

describe('FRQ dashboard queries', () => {
	beforeEach(() => vi.clearAllMocks());

	it('maps grouped SQL totals and handles zero available points', async () => {
		mocks.select.mockReturnValueOnce(
			progressQuery([
				{
					course: 'AP Biology',
					unit: 'Unit 2',
					attempts: '3',
					pointsEarned: '7',
					pointsAvailable: '10',
					lastAttemptAt: new Date('2026-08-01T00:00:00.000Z')
				},
				{
					course: 'AP Biology',
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
				course: 'AP Biology',
				unit: 'Unit 2',
				attempts: 3,
				pointsEarned: 7,
				pointsAvailable: 10,
				averagePercentage: 70,
				lastAttemptAt: '2026-08-01T00:00:00.000Z'
			},
			{
				course: 'AP Biology',
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
