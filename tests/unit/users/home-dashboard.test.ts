import { describe, expect, it } from 'vitest';
import {
	buildHomeCourseCards,
	recommendHomeCourse,
	SUBJECT_PROGRESS_GOAL
} from '#lib/users/home-dashboard.server.js';
import type { ProgressEntry, StatsData } from '#lib/users/types.js';

const emptyStats: StatsData = {
	overview: {
		totalQuestions: 0,
		correctAnswers: 0,
		accuracy: 0,
		currentStreak: 0,
		totalTimeHours: 0,
		frqSubmissions: 0,
		frqAveragePercentage: 0,
		memberSince: '2026-01-01T00:00:00.000Z'
	},
	recentPerformance: {
		questionsLast7Days: 0,
		accuracyLast7Days: 0,
		frqSubmissionsLast7Days: 0
	},
	courseBreakdown: []
};

describe('home dashboard selected courses', () => {
	it('preserves selection order and includes courses with no activity', () => {
		const selected = ['AP Chemistry', 'AP Biology'];
		const stats: StatsData = {
			...emptyStats,
			courseBreakdown: [
				{
					course: 'AP Biology',
					total: 40,
					correct: 30,
					accuracy: 75,
					avgTimeSeconds: 20,
					frqAttempts: 0,
					frqAveragePercentage: 0
				}
			]
		};
		const progress: ProgressEntry[] = [
			{
				course: 'AP Biology',
				unit: 'Unit 1',
				totalAttempts: 40,
				mastery: 75,
				lastAttemptAt: '2026-11-01T12:00:00.000Z'
			}
		];

		const courses = buildHomeCourseCards(selected, stats, progress);
		expect(courses.map((course) => course.name)).toEqual(selected);
		expect(courses[0]).toMatchObject({
			id: 'ap-chemistry',
			answered: 0,
			percent: 0,
			lastPracticedAt: null
		});
		expect(courses[1]).toMatchObject({
			id: 'ap-biology',
			answered: 40,
			shown: 40,
			percent: 40,
			lastPracticedAt: '2026-11-01T12:00:00.000Z'
		});
	});

	it('caps progress at 100% of the 100-question goal', () => {
		const stats: StatsData = {
			...emptyStats,
			courseBreakdown: [
				{
					course: 'AP Biology',
					total: 250,
					correct: 200,
					accuracy: 80,
					avgTimeSeconds: 15,
					frqAttempts: 0,
					frqAveragePercentage: 0
				}
			]
		};
		const [course] = buildHomeCourseCards(['AP Biology'], stats, []);
		expect(course).toMatchObject({
			answered: 250,
			shown: SUBJECT_PROGRESS_GOAL,
			percent: 100
		});
	});

	it('recommends the most recently practiced selected course, else the first', () => {
		const courses = buildHomeCourseCards(
			['AP Chemistry', 'AP Biology', 'AP Physics 1'],
			{
				...emptyStats,
				courseBreakdown: [
					{
						course: 'AP Biology',
						total: 10,
						correct: 8,
						accuracy: 80,
						avgTimeSeconds: 10,
						frqAttempts: 0,
						frqAveragePercentage: 0
					},
					{
						course: 'AP Physics 1',
						total: 5,
						correct: 4,
						accuracy: 80,
						avgTimeSeconds: 10,
						frqAttempts: 0,
						frqAveragePercentage: 0
					}
				]
			},
			[
				{
					course: 'AP Biology',
					unit: 'Unit 1',
					totalAttempts: 10,
					mastery: 80,
					lastAttemptAt: '2026-10-01T00:00:00.000Z'
				},
				{
					course: 'AP Physics 1',
					unit: 'Unit 1',
					totalAttempts: 5,
					mastery: 80,
					lastAttemptAt: '2026-11-01T00:00:00.000Z'
				}
			]
		);

		expect(recommendHomeCourse(courses).course?.name).toBe('AP Physics 1');
		expect(
			recommendHomeCourse(buildHomeCourseCards(['AP Chemistry'], emptyStats, [])).course?.name
		).toBe('AP Chemistry');
		expect(recommendHomeCourse([]).course).toBeNull();
	});
});
