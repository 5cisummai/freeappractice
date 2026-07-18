import { describe, expect, it } from 'vitest';
import {
	buildProgressData,
	findOrCreateProgressEntry,
	mergeFrqProgress
} from '$lib/users/progress.server';
import type { IProgress } from '$lib/users/records.server';
import type { IUserProfile } from '$lib/users/model.server';

describe('findOrCreateProgressEntry', () => {
	it('returns an existing entry for the same class and unit', () => {
		const progress: IProgress[] = [
			{
				apClass: 'AP Biology',
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
			apClass: 'AP Chemistry',
			unit: 'Unit 2',
			completed: false,
			mastery: 0,
			totalAttempts: 0,
			correctAttempts: 0
		});
	});
});

describe('buildProgressData', () => {
	it('maps profile progress into API entries', () => {
		const lastAttemptAt = new Date('2026-07-01T00:00:00.000Z');
		const user = {
			progress: [
				{
					apClass: 'AP Biology',
					unit: 'Unit 1',
					completed: false,
					mastery: 50,
					totalAttempts: 4,
					correctAttempts: 2,
					lastAttemptAt
				}
			]
		} as IUserProfile;

		expect(buildProgressData(user)).toEqual([
			{
				apClass: 'AP Biology',
				unit: 'Unit 1',
				totalAttempts: 4,
				correctAttempts: 2,
				mastery: 50,
				lastAttemptAt: lastAttemptAt.toISOString()
			}
		]);
	});
});

describe('mergeFrqProgress', () => {
	it('keeps MCQ mastery independent from FRQ percentages', () => {
		const merged = mergeFrqProgress(
			[
				{
					apClass: 'AP Biology',
					unit: 'Unit 4',
					totalAttempts: 2,
					correctAttempts: 1,
					mastery: 50
				}
			],
			[
				{
					apClass: 'AP Biology',
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
