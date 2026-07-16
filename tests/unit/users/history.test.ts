import { describe, expect, it } from 'vitest';
import { getMcqHistoryPage, parseHistorySort } from '$lib/users/history.server';
import type { IQuestionAttempt } from '$lib/users/records.server';

function attempt(
	overrides: Partial<IQuestionAttempt> &
		Pick<IQuestionAttempt, 'questionId' | 'apClass' | 'attemptedAt' | 'wasCorrect'>
): IQuestionAttempt {
	return {
		unit: 'Unit 1',
		selectedAnswer: 'A',
		...overrides
	};
}

describe('parseHistorySort', () => {
	it('defaults to attemptedAt desc', () => {
		expect(parseHistorySort(null, null)).toEqual({
			field: 'attemptedAt',
			direction: 'desc'
		});
	});

	it('accepts known fields and asc direction', () => {
		expect(parseHistorySort('subject', 'asc')).toEqual({
			field: 'subject',
			direction: 'asc'
		});
		expect(parseHistorySort('result', 'desc')).toEqual({
			field: 'result',
			direction: 'desc'
		});
		expect(parseHistorySort('nope', 'asc').field).toBe('attemptedAt');
	});
});

describe('getMcqHistoryPage', () => {
	const history = [
		attempt({
			questionId: '1',
			apClass: 'AP Biology',
			wasCorrect: true,
			attemptedAt: new Date('2026-07-01T00:00:00.000Z')
		}),
		attempt({
			questionId: '2',
			apClass: 'AP Chemistry',
			wasCorrect: false,
			attemptedAt: new Date('2026-07-03T00:00:00.000Z')
		}),
		attempt({
			questionId: '3',
			apClass: 'AP Biology',
			wasCorrect: false,
			attemptedAt: new Date('2026-07-02T00:00:00.000Z')
		})
	];

	it('filters by class, sorts, and paginates', () => {
		const page = getMcqHistoryPage(
			{ questionHistory: history },
			{
				page: 1,
				limit: 1,
				apClass: 'AP Biology',
				sort: { field: 'attemptedAt', direction: 'desc' }
			}
		);

		expect(page.total).toBe(2);
		expect(page.items).toHaveLength(1);
		expect(page.items[0]?.attempt.questionId).toBe('3');
		expect(page.items[0]?.question).toBeNull();
	});

	it('sorts by subject ascending', () => {
		const page = getMcqHistoryPage(
			{ questionHistory: history },
			{
				page: 1,
				limit: 10,
				sort: { field: 'subject', direction: 'asc' }
			}
		);
		expect(page.items.map((item) => item.attempt.apClass)).toEqual([
			'AP Biology',
			'AP Biology',
			'AP Chemistry'
		]);
	});
});
