import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), getQuestionsLookupMap: vi.fn() }));

vi.mock('$lib/server/db', () => ({ connectDb: vi.fn() }));
vi.mock('$lib/frq/model.server', () => ({ FrqAttempt: { find: mocks.find } }));
vi.mock('$lib/questions/storage.server', () => ({
	getQuestionsLookupMap: mocks.getQuestionsLookupMap
}));

import { getPracticeHistoryPage, hydratePracticeHistoryItems } from '$lib/users/history.server';

describe('getPracticeHistoryPage', () => {
	it('merges authenticated FRQ attempts with MCQ history and sorts them together', async () => {
		mocks.find.mockReturnValue({
			lean: () => ({
				exec: async () => [
					{
						_id: 'frq-attempt-1',
						questionId: 'frq-question-1',
						apClass: 'AP Biology',
						unit: 'Unit 4',
						timeTakenMs: 2_000,
						createdAt: new Date('2026-07-03T00:00:00.000Z'),
						grade: { pointsEarned: 8, pointsAvailable: 10, percentage: 80 }
					}
				]
			})
		});

		const page = await getPracticeHistoryPage(
			{
				questionHistory: [
					{
						questionId: 'mcq-question-1',
						apClass: 'AP Biology',
						unit: 'Unit 4',
						wasCorrect: true,
						attemptedAt: new Date('2026-07-02T00:00:00.000Z')
					}
				]
			},
			'user-1',
			{ page: 1, limit: 10, sort: { field: 'attemptedAt', direction: 'desc' } }
		);

		expect(page.total).toBe(2);
		expect(page.items.map((item) => item.kind)).toEqual(['frq', 'mcq']);
		expect(page.items[0]?.attempt.questionId).toBe('frq-question-1');
	});
});

describe('hydratePracticeHistoryItems', () => {
	it('keeps distinct MCQ attempts that share the same questionId', async () => {
		mocks.getQuestionsLookupMap.mockResolvedValue(
			new Map([
				[
					'shared-question',
					{
						id: 'shared-question',
						stem: 'Shared question',
						choices: [],
						correctAnswer: 'A'
					}
				]
			])
		);

		const hydrated = await hydratePracticeHistoryItems([
			{
				kind: 'mcq',
				attempt: {
					questionId: 'shared-question',
					apClass: 'AP Biology',
					unit: 'Unit 1',
					wasCorrect: true,
					selectedAnswer: 'A',
					attemptedAt: new Date('2026-07-01T00:00:00.000Z')
				},
				question: null
			},
			{
				kind: 'mcq',
				attempt: {
					questionId: 'shared-question',
					apClass: 'AP Biology',
					unit: 'Unit 1',
					wasCorrect: false,
					selectedAnswer: 'B',
					attemptedAt: new Date('2026-07-02T00:00:00.000Z')
				},
				question: null
			}
		]);

		expect(hydrated).toHaveLength(2);
		expect(hydrated[0]?.attempt.wasCorrect).toBe(true);
		expect(hydrated[1]?.attempt.wasCorrect).toBe(false);
		expect(hydrated[0]?.question?.id).toBe('shared-question');
		expect(hydrated[1]?.question?.id).toBe('shared-question');
	});
});
