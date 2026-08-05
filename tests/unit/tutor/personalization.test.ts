import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getTutorProfileView: vi.fn(),
	searchTutorMemories: vi.fn(),
	profileFindOne: vi.fn(),
	frqFind: vi.fn()
}));

vi.mock('$lib/mem0/service.server', () => ({
	searchTutorMemories: mocks.searchTutorMemories
}));
vi.mock('$lib/super/profile.server', () => ({
	getTutorProfileView: mocks.getTutorProfileView
}));
vi.mock('$lib/users/model.server', () => ({
	UserProfile: { findOne: mocks.profileFindOne }
}));
vi.mock('$lib/frq/model.server', () => ({
	FrqAttempt: { find: mocks.frqFind }
}));

import { buildTutorPersonalization } from '$lib/tutor/personalization.server';

function queryChain<T>(value: T) {
	const exec = vi.fn(async () => value);
	const lean = vi.fn(() => ({ exec }));
	const limit = vi.fn(() => ({ lean }));
	const sort = vi.fn(() => ({ limit }));
	const select = vi.fn(() => ({ lean }));
	return {
		select,
		sort,
		limit,
		lean,
		exec
	};
}

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
		mocks.profileFindOne.mockReturnValue(
			queryChain({
				progress: [
					{
						apClass: 'AP Biology',
						unit: 'Unit 2',
						mastery: 62,
						totalAttempts: 4,
						lastAttemptAt: new Date('2026-07-20T00:00:00.000Z')
					}
				]
			})
		);
		mocks.searchTutorMemories.mockResolvedValue([]);
	});

	it('adds bounded graded FRQ course/unit evidence without reading response or rubric text', async () => {
		const forbiddenResponse = 'STUDENT_RESPONSE_SHOULD_NOT_ENTER_CONTEXT';
		const forbiddenFeedback = 'RUBRIC_FEEDBACK_SHOULD_NOT_ENTER_CONTEXT';
		mocks.frqFind.mockReturnValue(
			queryChain([
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
			])
		);

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

		expect(mocks.frqFind).toHaveBeenCalledWith(
			{ userId: 'user-1', status: 'graded' },
			expect.objectContaining({
				apClass: 1,
				unit: 1,
				createdAt: 1,
				'grade.percentage': 1,
				'grade.pointsEarned': 1,
				'grade.pointsAvailable': 1,
				_id: 0
			})
		);
		const projection = mocks.frqFind.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(projection).not.toHaveProperty('responses');
		expect(projection).not.toHaveProperty('grade.criteria');
		expect(projection).not.toHaveProperty('grade.overallFeedback');
	});

	it('limits evidence to the most recent course/unit groups and ignores incomplete grades', async () => {
		mocks.frqFind.mockReturnValue(
			queryChain([
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
			])
		);

		const result = await buildTutorPersonalization('user-1', 'Review my weak units');

		expect(result.context.match(/graded FRQ/g)).toHaveLength(5);
		expect(result.context).toContain('AP Course 1 Unit 1');
		expect(result.context).toContain('AP Course 5 Unit 1');
		expect(result.context).not.toContain('AP Course 6 Unit 1');
		expect(result.context).not.toContain('AP Course 7 Unit 1');

		const chain = mocks.frqFind.mock.results[0]?.value;
		expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
		expect(chain.sort.mock.results[0]?.value.limit).toHaveBeenCalledWith(12);
	});
});
