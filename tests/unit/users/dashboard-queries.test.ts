import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	execute: vi.fn(),
	getFrqProgressForUser: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({ select: mocks.select, execute: mocks.execute })
}));
vi.mock('$lib/frq/attempts.server', () => ({
	getFrqProgressForUser: mocks.getFrqProgressForUser
}));

import { getDashboardProgress, getDashboardStats } from '$lib/users/dashboard-queries.server';

function plainQuery(rows: unknown[]) {
	return { from: () => ({ where: async () => rows }) };
}

function groupedQuery(rows: unknown[]) {
	return { from: () => ({ where: () => ({ groupBy: async () => rows }) }) };
}

function joinedQuery(rows: unknown[], grouped = false) {
	return {
		from: () => ({
			innerJoin: () => ({
				where: () => (grouped ? { groupBy: async () => rows } : Promise.resolve(rows))
			})
		})
	};
}

describe('dashboard aggregate queries', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getFrqProgressForUser.mockResolvedValue([]);
	});

	it('builds lifetime and recent stats from aggregate rows', async () => {
		mocks.select
			.mockReturnValueOnce(
				plainQuery([
					{ total: 8, correct: 6, totalTimeMs: 80_000, recentTotal: 4, recentCorrect: 3 }
				])
			)
			.mockReturnValueOnce(
				groupedQuery([{ subject: 'AP Biology', total: 8, correct: 6, totalTimeMs: 80_000 }])
			)
			.mockReturnValueOnce(
				joinedQuery([{ total: 2, averagePercentage: 75, totalTimeMs: 40_000, recentTotal: 1 }])
			)
			.mockReturnValueOnce(
				joinedQuery([{ subject: 'AP Biology', total: 2, totalPercentage: 150 }], true)
			);
		mocks.execute.mockResolvedValueOnce({ rows: [{ streak: 5 }] });

		const stats = await getDashboardStats(
			'student-1',
			new Date('2026-01-01T00:00:00.000Z'),
			'UTC',
			true
		);

		expect(stats).toMatchObject({
			overview: {
				totalQuestions: 8,
				correctAnswers: 6,
				accuracy: 75,
				currentStreak: 5,
				frqSubmissions: 2,
				frqAveragePercentage: 75
			},
			recentPerformance: {
				questionsLast7Days: 4,
				accuracyLast7Days: 75,
				frqSubmissionsLast7Days: 1
			},
			subjectBreakdown: [
				{
					subject: 'AP Biology',
					total: 8,
					correct: 6,
					frqAttempts: 2,
					frqAveragePercentage: 75
				}
			]
		});
	});

	it('uses only twenty recent attempts per unit and grouped topic rows for progress', async () => {
		const recent = Array.from({ length: 15 }, (_, index) => ({
			apClass: 'AP Biology',
			unit: 'Unit 1',
			wasCorrect: index < 10,
			attemptedAt: new Date(Date.UTC(2026, 7, 20 - index))
		}));
		mocks.execute.mockResolvedValueOnce({ rows: recent });
		mocks.select.mockReturnValueOnce(
			joinedQuery(
				[
					{
						apClass: 'AP Biology',
						unit: 'Unit 1',
						name: 'Cell signaling',
						attempts: 8,
						correctAttempts: 6,
						gradedAttempts: 8,
						lastAttemptAt: new Date('2026-08-20T00:00:00.000Z')
					}
				],
				true
			)
		);
		mocks.getFrqProgressForUser.mockResolvedValueOnce([]);

		const progress = await getDashboardProgress(
			'student-1',
			[
				{
					apClass: 'AP Biology',
					unit: 'Unit 1',
					completed: false,
					mastery: 67,
					totalAttempts: 15,
					correctAttempts: 10
				}
			],
			true
		);

		expect(progress[0]).toMatchObject({
			recentDelta: 100,
			recentMistakes: 5,
			topics: [
				{
					name: 'Cell signaling',
					attempts: 8,
					correctAttempts: 6,
					mastery: 75,
					lastAttemptAt: '2026-08-20T00:00:00.000Z'
				}
			]
		});
	});
});
