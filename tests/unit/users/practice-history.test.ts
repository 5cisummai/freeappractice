import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	select: vi.fn(),
	execute: vi.fn(),
	rows: [] as unknown[][]
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		select: mocks.select,
		execute: mocks.execute
	})
}));

import { getPracticeHistoryPage, hydratePracticeHistoryItems } from '$lib/users/history.server';

function queueRows(...rows: unknown[][]): void {
	mocks.rows = rows;
	mocks.select.mockImplementation(() => {
		const result = mocks.rows.shift() ?? [];
		const where = vi.fn().mockResolvedValue(result);
		const innerJoin = vi.fn().mockReturnValue({ where });
		return {
			from: vi.fn().mockReturnValue({ where, innerJoin })
		};
	});
}

describe('getPracticeHistoryPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.rows = [];
	});

	it('pages a SQL union and calculates the summary in SQL', async () => {
		mocks.execute
			.mockResolvedValueOnce({
				rows: [
					{
						kind: 'frq',
						id: 'frq-attempt-1',
						questionId: 'frq-question-1',
						apClass: 'AP Biology',
						unit: 'Unit 4',
						selectedAnswer: null,
						wasCorrect: null,
						timeTakenMs: 3_000,
						attemptedAt: new Date('2026-07-03T00:00:00.000Z'),
						finalAnswer: null,
						answerCount: null,
						hintsShown: null,
						terminalOutcome: null,
						experimentKey: null,
						experimentVersion: null,
						displayedVariant: null,
						pointsEarned: 8,
						pointsAvailable: 10,
						percentage: 80,
						resultScore: 80
					},
					{
						kind: 'mcq',
						id: 'mcq-attempt-1',
						questionId: 'mcq-question-1',
						apClass: 'AP Biology',
						unit: 'Unit 4',
						selectedAnswer: 'A',
						wasCorrect: true,
						timeTakenMs: 2_000,
						attemptedAt: new Date('2026-07-03T00:00:00.000Z'),
						finalAnswer: null,
						answerCount: null,
						hintsShown: null,
						terminalOutcome: null,
						experimentKey: null,
						experimentVersion: null,
						displayedVariant: null,
						pointsEarned: null,
						pointsAvailable: null,
						percentage: null,
						resultScore: 100
					}
				]
			})
			.mockResolvedValueOnce({
				rows: [{ total: 2, answered: 2, correct: 2, graded: 2, avgTimeMs: 2500 }]
			});

		const page = await getPracticeHistoryPage('user-1', {
			page: 1,
			limit: 10,
			sort: { field: 'attemptedAt', direction: 'desc' }
		});

		expect(page.total).toBe(2);
		expect(page.items.map((item) => item.kind)).toEqual(['frq', 'mcq']);
		expect(page.items[0]?.attempt.questionId).toBe('frq-question-1');
		expect(page.summary).toEqual({
			total: 2,
			answered: 2,
			correct: 2,
			accuracy: 100,
			avgTimeMs: 2500
		});
		expect(mocks.execute).toHaveBeenCalledTimes(2);
	});

	it('prunes the unused source and keeps the summary when the requested page is empty', async () => {
		mocks.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
			rows: [{ total: 1, answered: 0, correct: 0, graded: 0, avgTimeMs: 1000 }]
		});

		const page = await getPracticeHistoryPage('user-1', {
			page: 2,
			limit: 10,
			includeFrq: false,
			filters: { kind: 'mcq' }
		});

		expect(page.items).toEqual([]);
		expect(page.total).toBe(1);
		expect(page.summary).toEqual({
			total: 1,
			answered: 0,
			correct: 0,
			accuracy: null,
			avgTimeMs: 1000
		});
		expect(mocks.execute).toHaveBeenCalledTimes(2);
	});
});

describe('hydratePracticeHistoryItems', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('hydrates only page MCQs with one direct lookup while keeping distinct attempts', async () => {
		queueRows([
			{
				id: 'shared-question',
				data: {
					question: 'Shared question',
					optionA: 'A',
					optionB: 'B',
					optionC: 'C',
					optionD: 'D',
					correctAnswer: 'A',
					explanation: 'Because.',
					hint1: null,
					hint2: null,
					apClass: 'AP Biology',
					unit: 'Unit 1'
				},
				contentHash: 'hash',
				createdAt: new Date('2026-07-01T00:00:00.000Z')
			}
		]);

		const hydrated = await hydratePracticeHistoryItems([
			{
				kind: 'mcq',
				attempt: {
					questionId: 'shared-question',
					apClass: 'AP Biology',
					unit: 'Unit 1',
					wasCorrect: true,
					selectedAnswer: 'A',
					attemptedAt: '2026-07-01T00:00:00.000Z'
				},
				question: null
			},
			{
				kind: 'frq',
				attempt: {
					id: 'frq-1',
					questionId: 'frq-question-1',
					apClass: 'AP Biology',
					unit: 'Unit 1',
					pointsEarned: 8,
					pointsAvailable: 10,
					percentage: 80,
					timeTakenMs: 1000,
					attemptedAt: '2026-07-02T00:00:00.000Z'
				},
				question: null
			}
		]);

		expect(hydrated[0]).toMatchObject({
			kind: 'mcq',
			question: { id: 'shared-question', correctAnswer: 'A' }
		});
		expect(hydrated[1]?.kind).toBe('frq');
		expect(mocks.select).toHaveBeenCalledOnce();
	});
});
