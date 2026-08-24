import { describe, expect, it } from 'vitest';
import type { HistoryItem, ProgressEntry } from '$lib/users/types.js';
import {
	accuracyByScope,
	buildAccuracyDays,
	selectNextFocus,
	stackedActivityByScope
} from '$lib/components/progress/progress-metrics.js';

function topicEntry(
	overrides: Partial<ProgressEntry> & Pick<ProgressEntry, 'topics'>
): ProgressEntry {
	return {
		apClass: 'AP Biology',
		unit: 'Unit 4',
		totalAttempts: 18,
		mastery: 62,
		...overrides
	};
}

describe('selectNextFocus', () => {
	it('picks the lowest-mastery topic with at least 3 attempts', () => {
		const focus = selectNextFocus([
			topicEntry({
				unit: 'Unit 1',
				mastery: 91,
				topics: [
					{ name: 'Foundations', attempts: 10, correctAttempts: 9, mastery: 91 },
					{ name: 'Chemistry of life', attempts: 4, correctAttempts: 3, mastery: 80 }
				]
			}),
			topicEntry({
				unit: 'Unit 4',
				mastery: 62,
				recentMistakes: 1,
				topics: [
					{ name: 'Cell Communication', attempts: 18, correctAttempts: 11, mastery: 62 },
					{ name: 'Too few', attempts: 2, correctAttempts: 0, mastery: 0 }
				]
			})
		]);

		expect(focus).toMatchObject({
			kind: 'topic',
			topic: 'Cell Communication',
			mastery: 62
		});
	});

	it('breaks mastery ties using recent mistakes on the parent unit', () => {
		const focus = selectNextFocus([
			topicEntry({
				unit: 'Unit 2',
				recentMistakes: 1,
				topics: [{ name: 'A', attempts: 5, correctAttempts: 2, mastery: 40 }]
			}),
			topicEntry({
				unit: 'Unit 3',
				recentMistakes: 5,
				topics: [{ name: 'B', attempts: 5, correctAttempts: 2, mastery: 40 }]
			})
		]);

		expect(focus?.topic).toBe('B');
		expect(focus?.reason).toBe('recent-mistakes');
	});

	it('falls back to the lowest-mastery unit when no topic has enough attempts', () => {
		const focus = selectNextFocus([
			{
				apClass: 'AP Biology',
				unit: 'Unit 1',
				totalAttempts: 8,
				mastery: 80,
				topics: [{ name: 'A', attempts: 1, correctAttempts: 1, mastery: 100 }]
			},
			{
				apClass: 'AP Biology',
				unit: 'Unit 4',
				totalAttempts: 6,
				mastery: 50,
				topics: [{ name: 'B', attempts: 2, correctAttempts: 0, mastery: 0 }]
			}
		]);

		expect(focus).toMatchObject({ kind: 'unit', unit: 'Unit 4', mastery: 50 });
	});

	it('returns null when there is no progress to recommend', () => {
		expect(selectNextFocus([])).toBeNull();
	});
});

describe('history chart derivations', () => {
	it('keeps days without answers as null accuracy instead of zero', () => {
		const now = new Date();
		const item: HistoryItem = {
			kind: 'mcq',
			attempt: {
				questionId: 'q1',
				apClass: 'AP Biology',
				unit: 'Unit 1',
				wasCorrect: true,
				attemptedAt: now.toISOString()
			},
			question: null
		};

		const days = buildAccuracyDays([item], 3);
		expect(days).toHaveLength(3);
		const today = days.at(-1);
		expect(today?.accuracy).toBe(100);
		expect(days.filter((day) => day.accuracy === null).length).toBe(2);
	});
});

describe('stacked activity derivation', () => {
	const today = new Date();
	const history: HistoryItem[] = [
		{
			kind: 'mcq',
			attempt: {
				questionId: 'q1',
				apClass: 'AP Biology',
				unit: 'Unit 1',
				attemptedAt: today.toISOString()
			},
			question: null
		},
		{
			kind: 'mcq',
			attempt: {
				questionId: 'q2',
				apClass: 'AP Chemistry',
				unit: 'Unit 1',
				attemptedAt: today.toISOString()
			},
			question: null
		}
	];

	it('stacks classes by day for all courses', () => {
		const result = stackedActivityByScope(history, 'all', 3);
		const todayRow = result.rows.at(-1);
		expect(result.series.map((item) => item.label)).toEqual(['AP Biology', 'AP Chemistry']);
		expect(todayRow).toMatchObject({
			total: 2,
			[result.series[0]?.key ?? '']: 1,
			[result.series[1]?.key ?? '']: 1
		});
	});

	it('stacks units by day for a selected class', () => {
		const result = stackedActivityByScope(
			[
				...history,
				{
					kind: 'mcq',
					attempt: {
						questionId: 'q3',
						apClass: 'AP Biology',
						unit: 'Unit 2',
						attemptedAt: today.toISOString()
					},
					question: null
				}
			],
			'AP Biology',
			3
		);
		const todayRow = result.rows.at(-1);
		expect(result.series.map((item) => item.label)).toEqual(['Unit 1', 'Unit 2']);
		expect(todayRow).toMatchObject({
			total: 2,
			[result.series[0]?.key ?? '']: 1,
			[result.series[1]?.key ?? '']: 1
		});
	});

	it('groups lower-volume categories into Other', () => {
		const manyClasses = Array.from({ length: 9 }, (_, index) => ({
			kind: 'mcq' as const,
			attempt: {
				questionId: `q-${index}`,
				apClass: `AP Class ${index}`,
				unit: 'Unit 1',
				attemptedAt: today.toISOString()
			},
			question: null
		}));
		const result = stackedActivityByScope(manyClasses, 'all', 3);
		const todayRow = result.rows.at(-1);

		expect(result.series).toHaveLength(9);
		expect(result.series.at(-1)?.label).toBe('Other');
		expect(todayRow?.total).toBe(9);
		expect(todayRow?.['series-other']).toBe(1);
	});

	it('prioritizes selected classes before grouping the rest into Other', () => {
		const manyClasses = Array.from({ length: 9 }, (_, index) => ({
			kind: 'mcq' as const,
			attempt: {
				questionId: `priority-q-${index}`,
				apClass: `AP Priority Class ${index}`,
				unit: 'Unit 1',
				attemptedAt: today.toISOString()
			},
			question: null
		}));
		const result = stackedActivityByScope(manyClasses, 'all', 3, ['AP Priority Class 8']);

		expect(result.series.map((item) => item.label)).toContain('AP Priority Class 8');
		expect(result.series.map((item) => item.label)).toContain('Other');
		expect(result.series.map((item) => item.label)).not.toContain('AP Priority Class 7');
	});

	it('keeps the same series order across selected time ranges', () => {
		const olderDate = new Date(today);
		olderDate.setDate(olderDate.getDate() - 2);
		const historyWithDifferentVolumes: HistoryItem[] = [
			{
				kind: 'mcq',
				attempt: {
					questionId: 'recent-biology',
					apClass: 'AP Biology',
					unit: 'Unit 1',
					attemptedAt: today.toISOString()
				},
				question: null
			},
			...Array.from({ length: 3 }, (_, index) => ({
				kind: 'mcq' as const,
				attempt: {
					questionId: `older-chemistry-${index}`,
					apClass: 'AP Chemistry',
					unit: 'Unit 1',
					attemptedAt: olderDate.toISOString()
				},
				question: null
			}))
		];

		expect(stackedActivityByScope(historyWithDifferentVolumes, 'all', 1).series).toEqual(
			stackedActivityByScope(historyWithDifferentVolumes, 'all', 3).series
		);
	});
});

describe('accuracy scope derivation', () => {
	const today = new Date();

	it('groups accuracy by class across all courses', () => {
		const result = accuracyByScope(
			[
				{
					kind: 'mcq',
					attempt: {
						questionId: 'accuracy-1',
						apClass: 'AP Biology',
						unit: 'Unit 1',
						wasCorrect: true,
						attemptedAt: today.toISOString()
					},
					question: null
				},
				{
					kind: 'mcq',
					attempt: {
						questionId: 'accuracy-2',
						apClass: 'AP Biology',
						unit: 'Unit 1',
						wasCorrect: false,
						attemptedAt: today.toISOString()
					},
					question: null
				}
			],
			'all'
		);

		expect(result).toEqual([{ label: 'AP Biology', answered: 2, correct: 1, accuracy: 50 }]);
	});

	it('groups accuracy by unit for a selected course', () => {
		const result = accuracyByScope(
			[
				{
					kind: 'mcq',
					attempt: {
						questionId: 'unit-1',
						apClass: 'AP Biology',
						unit: 'Unit 1',
						wasCorrect: true,
						attemptedAt: today.toISOString()
					},
					question: null
				},
				{
					kind: 'mcq',
					attempt: {
						questionId: 'unit-2',
						apClass: 'AP Biology',
						unit: 'Unit 2',
						wasCorrect: false,
						attemptedAt: today.toISOString()
					},
					question: null
				}
			],
			'AP Biology'
		);

		expect(result.map((row) => row.label)).toEqual(['Unit 1', 'Unit 2']);
		expect(result.map((row) => row.accuracy)).toEqual([100, 0]);
	});
});
