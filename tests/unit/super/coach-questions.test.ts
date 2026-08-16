import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	mcqBankGet: vi.fn(),
	frqBankGet: vi.fn(),
	getQuestionById: vi.fn(),
	getFrqQuestionById: vi.fn(),
	getFrqCourseProfile: vi.fn(),
	getNeonDatabase: vi.fn()
}));

vi.mock('$lib/question-bank/mcq/bank.server', () => ({
	mcqBank: { get: mocks.mcqBankGet }
}));
vi.mock('$lib/question-bank/frq/bank.server', () => ({
	frqBank: { get: mocks.frqBankGet }
}));
vi.mock('$lib/question-bank/mcq/repository.server', () => ({
	getQuestionById: mocks.getQuestionById
}));
vi.mock('$lib/question-bank/frq/model.server', () => ({
	getFrqQuestionById: mocks.getFrqQuestionById
}));
vi.mock('$lib/question-bank/frq/profiles.server', () => ({
	getFrqCourseProfile: mocks.getFrqCourseProfile
}));
vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: mocks.getNeonDatabase
}));

import { giveCoachPracticeQuestion } from '$lib/super/coach-questions.server';

describe('giveCoachPracticeQuestion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getNeonDatabase.mockReturnValue({
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: async () => []
						})
					})
				})
			})
		});
	});

	it('returns an inline MCQ card payload', async () => {
		mocks.mcqBankGet.mockResolvedValue({
			status: 'found',
			result: {
				questionId: 'mcq-1',
				answer: {
					question: 'What is velocity?',
					optionA: 'Speed with direction',
					optionB: 'Distance over time only',
					optionC: 'Acceleration',
					optionD: 'Force',
					topicsCovered: 'Kinematics',
					hasDiagram: false,
					diagramSpec: null
				}
			}
		});
		mocks.getQuestionById.mockResolvedValue({
			id: 'mcq-1',
			apClass: 'AP Physics 1',
			unit: 'Unit 1'
		});

		await expect(
			giveCoachPracticeQuestion('user-1', { apClass: 'AP Physics 1', unit: 'Unit 1' })
		).resolves.toMatchObject({
			kind: 'practice_question',
			mode: 'mcq',
			questionId: 'mcq-1',
			apClass: 'AP Physics 1',
			unit: 'Unit 1',
			prompt: 'What is velocity?',
			practiceHref: '/app/practice?apClass=AP+Physics+1&unit=Unit+1&questionId=mcq-1',
			options: expect.arrayContaining([{ id: 'A', label: 'A', text: 'Speed with direction' }])
		});
	});

	it('returns an inline FRQ card payload', async () => {
		mocks.getFrqCourseProfile.mockReturnValue({});
		mocks.frqBankGet.mockResolvedValue({
			status: 'found',
			result: {
				questionId: 'frq-1',
				publicQuestion: {
					apClass: 'AP Biology',
					unit: 'Unit 2',
					topicsCovered: 'Cells',
					prompt: 'Describe osmosis.',
					sections: [
						{
							id: 'a',
							label: 'Part A',
							prompt: 'Explain the process.',
							responseKind: 'text',
							maxPoints: 4
						}
					],
					materials: []
				}
			}
		});

		await expect(
			giveCoachPracticeQuestion('user-1', {
				apClass: 'AP Biology',
				unit: 'Unit 2',
				mode: 'frq'
			})
		).resolves.toMatchObject({
			kind: 'practice_question',
			mode: 'frq',
			questionId: 'frq-1',
			prompt: 'Describe osmosis.',
			practiceHref: '/app/practice?apClass=AP+Biology&unit=Unit+2&questionId=frq-1&mode=frq'
		});
	});
});
