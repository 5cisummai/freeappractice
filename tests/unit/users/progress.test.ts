import { describe, expect, it } from 'vitest';
import { findOrCreateProgressEntry, mergeFrqProgress } from '#lib/users/progress.server.js';
import type { IProgress } from '#lib/users/records.server.js';

describe('findOrCreateProgressEntry', () => {
	it('returns an existing entry for the same class and unit', () => {
		const progress: IProgress[] = [
			{
				course: 'AP Biology',
				unit: 'Unit 1',
				completed: false,
				mastery: 40,
				totalAttempts: 2,
				correctAttempts: 1
			}
		];

		const entry = findOrCreateProgressEntry(progress, 'AP Biology', 'Unit 1');
		expect(entry.mastery).toBe(40);
		expect(progress).toHaveLength(1);
	});

	it('appends a new default entry when missing', () => {
		const progress: IProgress[] = [];
		const entry = findOrCreateProgressEntry(progress, 'AP Chemistry', 'Unit 2');
		expect(progress).toHaveLength(1);
		expect(entry).toMatchObject({
			course: 'AP Chemistry',
			unit: 'Unit 2',
			completed: false,
			mastery: 0,
			totalAttempts: 0,
			correctAttempts: 0
		});
	});
});

describe('mergeFrqProgress', () => {
	it('keeps MCQ mastery independent from FRQ percentages', () => {
		const merged = mergeFrqProgress(
			[
				{
					course: 'AP Biology',
					unit: 'Unit 4',
					totalAttempts: 2,
					correctAttempts: 1,
					mastery: 50
				}
			],
			[
				{
					course: 'AP Biology',
					unit: 'Unit 4',
					attempts: 1,
					pointsEarned: 9,
					pointsAvailable: 10,
					averagePercentage: 90
				}
			]
		);

		expect(merged[0]).toMatchObject({ mastery: 50, frqAveragePercentage: 90 });
	});
});
