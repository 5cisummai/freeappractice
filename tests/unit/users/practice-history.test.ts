import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock('$lib/server/db', () => ({ connectDb: vi.fn() }));
vi.mock('$lib/frq/model.server', () => ({ FrqAttempt: { find: mocks.find } }));

import { getPracticeHistoryPage } from '$lib/users/history.server';

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
