import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getTutorProfileView: vi.fn(),
	searchTutorMemories: vi.fn(),
	getUserProgress: vi.fn(),
	findRecentGradedFrqAttempts: vi.fn()
}));

vi.mock('$lib/mem0/service.server', () => ({
	searchTutorMemories: mocks.searchTutorMemories
}));
vi.mock('$lib/super/profile.server', () => ({
	getTutorProfileView: mocks.getTutorProfileView
}));
vi.mock('$lib/users/model.server', () => ({
	getUserProgress: mocks.getUserProgress
}));
vi.mock('$lib/frq/model.server', () => ({
	findRecentGradedFrqAttempts: mocks.findRecentGradedFrqAttempts
}));

import { buildTutorPersonalization } from '$lib/tutor/personalization.server';

describe('buildTutorPersonalization', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getTutorProfileView.mockResolvedValue({
			selectedApClasses: ['AP Biology'],
			targetDates: [],
			studyAvailability: null,
			teachingStyle: 'socratic',
			memoryEnabled: true,
			memoryDisclosureSeenAt: null,
			ageConfirmedAt: '2026-07-01T00:00:00.000Z'
		});
		mocks.getUserProgress.mockResolvedValue([
			{
				apClass: 'AP Biology',
				unit: 'Unit 2',
				mastery: 62,
				totalAttempts: 4,
				lastAttemptAt: new Date('2026-07-20T00:00:00.000Z')
			}
		]);
		mocks.searchTutorMemories.mockResolvedValue([]);
	});

	it('adds bounded graded FRQ course/unit evidence without reading response or rubric text', async () => {
		const forbiddenResponse = 'STUDENT_RESPONSE_SHOULD_NOT_ENTER_CONTEXT';
		const forbiddenFeedback = 'RUBRIC_FEEDBACK_SHOULD_NOT_ENTER_CONTEXT';
		mocks.findRecentGradedFrqAttempts.mockResolvedValue([
			{
				apClass: 'AP Biology',
				unit: 'Unit 2',
				createdAt: new Date('2026-07-20T00:00:00.000Z'),
				responses: { response: forbiddenResponse },
				grade: {
					percentage: 80,
					pointsEarned: 8,
					pointsAvailable: 10,
					overallFeedback: forbiddenFeedback,
					criteria: [{ evidence: forbiddenResponse, feedback: forbiddenFeedback }]
				}
			},
			{
				apClass: 'AP Biology',
				unit: 'Unit 2',
				createdAt: new Date('2026-07-19T00:00:00.000Z'),
				grade: { percentage: 50, pointsEarned: 5, pointsAvailable: 10 }
			},
			{
				apClass: 'AP Chemistry',
				unit: 'Unit 1',
				createdAt: new Date('2026-07-18T00:00:00.000Z'),
				grade: { percentage: 75, pointsEarned: 9, pointsAvailable: 12 }
			}
		]);

		const result = await buildTutorPersonalization('user-1', 'How can I improve?');

		expect(result.context).toContain(
			'AP Biology Unit 2: 2 graded FRQs, 65% aggregate (13/20 rubric points); recent percentages 80%, 50%.'
		);
		expect(result.context).toContain(
			'AP Chemistry Unit 1: 1 graded FRQ, 75% aggregate (9/12 rubric points); recent percentages 75%.'
		);
		expect(result.context).not.toContain(forbiddenResponse);
		expect(result.context).not.toContain(forbiddenFeedback);
		expect(result.memoryDegraded).toBe(false);

		expect(mocks.findRecentGradedFrqAttempts).toHaveBeenCalledWith('user-1', 12);
	});

	it('limits evidence to the most recent course/unit groups and ignores incomplete grades', async () => {
		mocks.findRecentGradedFrqAttempts.mockResolvedValue([
			...Array.from({ length: 6 }, (_, index) => ({
				apClass: `AP Course ${index + 1}`,
				unit: 'Unit 1',
				createdAt: new Date(Date.UTC(2026, 6, 20 - index)),
				grade: { percentage: 70, pointsEarned: 7, pointsAvailable: 10 }
			})),
			{
				apClass: 'AP Course 7',
				unit: 'Unit 1',
				createdAt: new Date('2026-07-01T00:00:00.000Z'),
				grade: { percentage: 100, pointsEarned: 10, pointsAvailable: 0 }
			}
		]);

		const result = await buildTutorPersonalization('user-1', 'Review my weak units');

		expect(result.context.match(/graded FRQ/g)).toHaveLength(5);
		expect(result.context).toContain('AP Course 1 Unit 1');
		expect(result.context).toContain('AP Course 5 Unit 1');
		expect(result.context).not.toContain('AP Course 6 Unit 1');
		expect(result.context).not.toContain('AP Course 7 Unit 1');

		expect(mocks.findRecentGradedFrqAttempts).toHaveBeenCalledWith('user-1', 12);
	});
});
