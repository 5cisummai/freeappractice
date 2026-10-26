import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	mcqBankGet: vi.fn(),
	frqBankGet: vi.fn(),
	getQuestionById: vi.fn(),
	getFrqQuestionById: vi.fn(),
	getFrqCourseProfile: vi.fn(),
	getNeonDatabase: vi.fn()
}));

vi.mock('#lib/question-bank/mcq/bank.server.js', () => ({
	mcqBank: { get: mocks.mcqBankGet }
}));
vi.mock('#lib/question-bank/frq/bank.server.js', () => ({
	frqBank: { get: mocks.frqBankGet }
}));
vi.mock('#lib/question-bank/mcq/repository.server.js', () => ({
	getQuestionById: mocks.getQuestionById
}));
vi.mock('#lib/question-bank/frq/model.server.js', () => ({
	getFrqQuestionById: mocks.getFrqQuestionById
}));
vi.mock('#lib/question-bank/frq/profiles.server.js', () => ({
	getFrqCourseProfile: mocks.getFrqCourseProfile
}));
vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: mocks.getNeonDatabase
}));

import {
	giveCoachPracticeQuestion,
	resolveCoachPracticeQuestionCatalog
} from '#lib/agent/tools/practice.server.js';

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
				course: 'AP Physics 1',
				unit: 'Unit 1',
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

		await expect(
			giveCoachPracticeQuestion('user-1', {
				course: 'AP Physics 1',
				unit: 'Unit 1: Kinematics'
			})
		).resolves.toMatchObject({
			kind: 'practice_question',
			mode: 'mcq',
			questionId: 'mcq-1',
			course: 'AP Physics 1',
			unit: 'Unit 1',
			prompt: 'What is velocity?',
			practiceHref: '/app/practice?course=AP+Physics+1&unit=Unit+1&questionId=mcq-1',
			options: expect.arrayContaining([{ id: 'A', label: 'A', text: 'Speed with direction' }])
		});
		expect(mocks.mcqBankGet).toHaveBeenCalledWith(
			'AP Physics 1',
			'Unit 1: Kinematics',
			expect.objectContaining({ allowRefill: true })
		);
		expect(mocks.getQuestionById).not.toHaveBeenCalled();
	});

	it('maps a unit title without the Unit N prefix to the catalog unit', async () => {
		mocks.mcqBankGet.mockResolvedValue({
			status: 'found',
			result: {
				questionId: 'mcq-2',
				course: 'AP Human Geography',
				unit: 'Unit 2: Population and Migration Patterns and Processes',
				answer: {
					question: 'What is a refugee?',
					optionA: 'A',
					optionB: 'B',
					optionC: 'C',
					optionD: 'D'
				}
			}
		});

		await giveCoachPracticeQuestion('user-1', {
			course: 'AP Human Geography',
			unit: 'Population and Migration Patterns and Processes'
		});

		expect(mocks.mcqBankGet).toHaveBeenCalledWith(
			'AP Human Geography',
			'Unit 2: Population and Migration Patterns and Processes',
			expect.objectContaining({ allowRefill: true })
		);
	});

	it('returns a client error for unknown courses and units without retryAfterSeconds', async () => {
		await expect(giveCoachPracticeQuestion('user-1', { course: 'AP' })).resolves.toEqual({
			error: '"AP" is not a supported AP course. Use the exact catalog course name.'
		});
		await expect(
			giveCoachPracticeQuestion('user-1', {
				course: 'AP Human Geography',
				unit: 'Unit 2: Population and'
			})
		).resolves.toEqual({
			error:
				'"Unit 2: Population and" is not a unit in AP Human Geography. Use the full catalog title, including the "Unit N:" prefix.'
		});
		expect(mocks.mcqBankGet).not.toHaveBeenCalled();
		expect(mocks.frqBankGet).not.toHaveBeenCalled();
	});

	it('resolves All Units to a catalog unit instead of an invalid pool bucket', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		expect(
			resolveCoachPracticeQuestionCatalog({
				course: 'AP Human Geography',
				mode: 'mcq'
			})
		).toEqual({
			ok: true,
			course: 'AP Human Geography',
			unit: 'Unit 1: Thinking Geographically',
			mode: 'mcq'
		});
		vi.restoreAllMocks();
	});

	it('still reports pool warming with retryAfterSeconds for a valid catalog unit', async () => {
		mocks.mcqBankGet.mockResolvedValue({ status: 'warming', retryAfterSeconds: 15 });

		await expect(
			giveCoachPracticeQuestion('user-1', {
				course: 'AP Human Geography',
				unit: 'Unit 2: Population and Migration Patterns and Processes'
			})
		).resolves.toEqual({
			error: 'Question pool is warming up. Please try again shortly.',
			retryAfterSeconds: 15
		});
	});

	it('returns an inline FRQ card payload', async () => {
		mocks.getFrqCourseProfile.mockReturnValue({});
		mocks.frqBankGet.mockResolvedValue({
			status: 'found',
			result: {
				questionId: 'frq-1',
				publicQuestion: {
					course: 'AP Biology',
					unit: 'Unit 2',
					topicsCovered: 'Cells',
					prompt: 'Describe osmosis.',
					responseMode: 'parts',
					parts: [
						{
							id: 'A',
							label: 'A',
							prompt: 'Explain the process.',
							points: 1
						}
					],
					materials: []
				}
			}
		});

		await expect(
			giveCoachPracticeQuestion('user-1', {
				course: 'AP Biology',
				unit: 'Unit 2: Cells',
				mode: 'frq'
			})
		).resolves.toMatchObject({
			kind: 'practice_question',
			mode: 'frq',
			questionId: 'frq-1',
			prompt: 'Describe osmosis.',
			practiceHref: '/app/practice?course=AP+Biology&unit=Unit+2&questionId=frq-1&mode=frq'
		});
	});
});
