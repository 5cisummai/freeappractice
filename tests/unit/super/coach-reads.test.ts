import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getUserDashboardProfile: vi.fn(),
	getDashboardStats: vi.fn(),
	getUserProgress: vi.fn(),
	getRecentSuperMistakes: vi.fn(),
	getCurrentStoredInsightReport: vi.fn(),
	findRecentGradedFrqAttempts: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: vi.fn()
}));
vi.mock('$lib/users/model.server', () => ({
	getUserDashboardProfile: mocks.getUserDashboardProfile,
	getUserProgress: mocks.getUserProgress
}));
vi.mock('$lib/users/dashboard-queries.server', () => ({
	getDashboardStats: mocks.getDashboardStats
}));
vi.mock('$lib/super/context.server', () => ({
	getRecentSuperMistakes: mocks.getRecentSuperMistakes
}));
vi.mock('$lib/super/insights.server', () => ({
	getCurrentStoredInsightReport: mocks.getCurrentStoredInsightReport
}));
vi.mock('$lib/grading/frq/storage.server', () => ({
	findRecentGradedFrqAttempts: mocks.findRecentGradedFrqAttempts
}));

import {
	getCoachActivitySummary,
	getCoachFrqPerformance,
	getCoachUnitDetail
} from '$lib/super/coach-reads.server';

describe('coach read tools', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('summarizes activity from dashboard stats', async () => {
		mocks.getUserDashboardProfile.mockResolvedValue({
			createdAt: new Date('2026-01-01T00:00:00.000Z')
		});
		mocks.getDashboardStats.mockResolvedValue({
			overview: {
				currentStreak: 4,
				totalTimeHours: 12.5,
				totalQuestions: 120,
				accuracy: 82,
				frqSubmissions: 6,
				frqAveragePercentage: 71
			},
			recentPerformance: {
				questionsLast7Days: 18,
				accuracyLast7Days: 78,
				frqSubmissionsLast7Days: 2
			},
			subjectBreakdown: [{ subject: 'AP Biology', total: 80, frqAttempts: 3 }]
		});

		await expect(getCoachActivitySummary('user-1')).resolves.toEqual({
			currentStreak: 4,
			totalTimeHours: 12.5,
			lifetime: {
				mcqAttempts: 120,
				mcqAccuracy: 82,
				frqSubmissions: 6,
				frqAveragePercentage: 71
			},
			last7Days: {
				mcqAttempts: 18,
				mcqAccuracy: 78,
				frqSubmissions: 2
			},
			subjectBreakdown: [{ subject: 'AP Biology', total: 80, frqAttempts: 3 }]
		});
	});

	it('combines unit progress, mistakes, and insights', async () => {
		mocks.getUserProgress.mockResolvedValue([
			{
				apClass: 'AP Biology',
				unit: 'Unit 3',
				mastery: 64,
				totalAttempts: 12,
				correctAttempts: 8,
				lastAttemptAt: new Date('2026-08-10T12:00:00.000Z'),
				lastReviewedAt: null
			}
		]);
		mocks.getRecentSuperMistakes.mockResolvedValue([
			{ questionId: 'q-1', apClass: 'AP Biology', unit: 'Unit 3' }
		]);
		mocks.getCurrentStoredInsightReport.mockResolvedValue({
			generatedAt: '2026-08-12T00:00:00.000Z',
			report: {
				courses: [
					{
						apClass: 'AP Biology',
						units: [
							{
								unit: 'Unit 3',
								totalScoredAttempts: 10,
								metrics: {},
								strengths: [{ apClass: 'AP Biology', unit: 'Unit 3' }],
								weaknesses: [],
								actionableInsights: ['Review cell signaling']
							}
						]
					}
				]
			}
		});

		await expect(getCoachUnitDetail('user-1', 'AP Biology', 'Unit 3')).resolves.toEqual({
			apClass: 'AP Biology',
			unit: 'Unit 3',
			progress: {
				mastery: 64,
				totalAttempts: 12,
				correctAttempts: 8,
				lastAttemptAt: '2026-08-10T12:00:00.000Z',
				lastReviewedAt: null
			},
			recentMistakes: [{ questionId: 'q-1', apClass: 'AP Biology', unit: 'Unit 3' }],
			insights: {
				totalScoredAttempts: 10,
				metrics: {},
				strengths: [{ apClass: 'AP Biology', unit: 'Unit 3' }],
				weaknesses: [],
				actionableInsights: ['Review cell signaling']
			},
			insightsGeneratedAt: '2026-08-12T00:00:00.000Z'
		});
	});

	it('returns sanitized FRQ performance without student responses', async () => {
		mocks.findRecentGradedFrqAttempts.mockResolvedValue([
			{
				id: 'attempt-1',
				questionId: 'question-1',
				apClass: 'AP Physics 1',
				unit: 'Unit 2',
				createdAt: new Date('2026-08-11T10:00:00.000Z'),
				responses: { sectionA: 'student answer text' },
				grade: {
					pointsEarned: 4,
					pointsAvailable: 7,
					percentage: 57,
					overallFeedback: 'Strong setup, weak analysis.',
					criteria: [
						{
							label: 'Free-body diagram',
							points: 2,
							pointsAvailable: 3,
							feedback: 'Missing friction arrow.',
							evidence: 'You wrote F=ma'
						}
					]
				}
			}
		]);

		await expect(
			getCoachFrqPerformance('user-1', { apClass: 'AP Physics 1', unit: 'Unit 2', limit: 3 })
		).resolves.toEqual([
			{
				attemptId: 'attempt-1',
				questionId: 'question-1',
				apClass: 'AP Physics 1',
				unit: 'Unit 2',
				attemptedAt: '2026-08-11T10:00:00.000Z',
				pointsEarned: 4,
				pointsAvailable: 7,
				percentage: 57,
				overallFeedback: 'Strong setup, weak analysis.',
				criteria: [
					{
						label: 'Free-body diagram',
						points: 2,
						pointsAvailable: 3,
						feedback: 'Missing friction arrow.'
					}
				]
			}
		]);
		expect(mocks.findRecentGradedFrqAttempts).toHaveBeenCalledWith('user-1', {
			limit: 3,
			apClass: 'AP Physics 1',
			unit: 'Unit 2'
		});
	});
});
