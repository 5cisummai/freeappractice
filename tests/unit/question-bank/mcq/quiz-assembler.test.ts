import { describe, expect, it, vi } from 'vitest';

const { findActiveQuestionsForQuizMock } = vi.hoisted(() => ({
	findActiveQuestionsForQuizMock: vi.fn()
}));

vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('$lib/question-bank/mcq/repository.server', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/question-bank/mcq/repository.server')>();
	return { ...actual, findActiveQuestionsForQuiz: findActiveQuestionsForQuizMock };
});

vi.mock('$lib/question-bank/mcq/stimulus-policy', () => ({
	isStimulusPolicyEnabledForUnit: (
		policy: { setsEnabled: boolean; enabledUnits?: string[] },
		unit?: string
	) => {
		if (!policy.setsEnabled) return false;
		if (policy.enabledUnits?.length) return policy.enabledUnits.includes(unit ?? '');
		return true;
	},
	getStimulusPolicy: () => ({
		version: 1,
		enabledUnits: ['Unit 1'],
		quizTargetQuestionPercent: 100,
		targetBasis: 'product-calibrated',
		setSizeBasis: 'product-calibrated',
		setsEnabled: true,
		allowDiscreteDiagrams: true,
		allowedDiscreteDiagramTypes: [],
		defaultProfileIds: ['shared'],
		profiles: [
			{
				id: 'shared',
				minChildren: 2,
				targetChildren: 4,
				maxChildren: 4,
				allowedModes: ['text'],
				diagramTypes: [],
				weight: 1
			}
		]
	})
}));

import { assembleMcqQuiz } from '$lib/question-bank/mcq/quiz-assembler.server';
import { logger } from '$lib/server/logger';

function question(id: string, position?: number) {
	return {
		questionId: id,
		randomKey: 0.1,
		active: true,
		contentHash: id,
		createdAt: new Date(),
		updatedAt: new Date(),
		apClass: 'AP Biology',
		unit: 'Unit 1',
		mainTopic: 'Topic',
		topicsCovered: 'Topic',
		question: `Question ${id}`,
		diagramSpec: null,
		hasDiagram: false,
		optionA: 'A',
		optionB: 'B',
		optionC: 'C',
		optionD: 'D',
		correctAnswer: 'A' as const,
		explanation: 'Explanation',
		stimulus: {
			text: 'Shared passage',
			diagramSpec: null,
			provenance: 'ai-generated-original' as const
		},
		stimulusId: position === undefined ? null : '00000000-0000-4000-8000-000000000001',
		stimulusPosition: position ?? null,
		stimulusQuestionCount: position === undefined ? null : 4
	};
}

describe('assembleMcqQuiz', () => {
	it('truncates a shared set to the remaining exact quiz capacity', async () => {
		findActiveQuestionsForQuizMock.mockResolvedValue([
			question('q0', 0),
			question('q1', 1),
			question('q2', 2),
			question('q3', 3)
		]);
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const result = await assembleMcqQuiz(
			{ apClass: 'AP Biology', unit: 'Unit 1', count: 2 },
			{ globalFlagEnabled: true }
		);
		expect(result.questions).toHaveLength(2);
		expect(result.questions.map((item) => item.questionId)).toEqual(['q0', 'q1']);
		expect(result.metrics.truncatedSetCount).toBe(1);
		vi.restoreAllMocks();
	});

	it('keeps a standalone stimulus question independently selectable', async () => {
		findActiveQuestionsForQuizMock.mockResolvedValue([question('standalone')]);
		const result = await assembleMcqQuiz(
			{ apClass: 'AP Biology', unit: 'Unit 1', count: 1 },
			{ globalFlagEnabled: true }
		);
		expect(result.questions[0]?.hasStimulus).toBe(true);
		expect(result.metrics.stimulusSetCount).toBe(0);
	});

	it('takes a contiguous ordered slice when a set is truncated', async () => {
		findActiveQuestionsForQuizMock.mockResolvedValue([
			question('q0', 0),
			question('q1', 1),
			question('q2', 2),
			question('q3', 3)
		]);
		vi.spyOn(Math, 'random').mockReturnValue(0.99);
		const result = await assembleMcqQuiz(
			{ apClass: 'AP Biology', unit: 'Unit 1', count: 2 },
			{ globalFlagEnabled: true }
		);
		expect(result.questions.map((item) => item.questionId)).toEqual(['q2', 'q3']);
		vi.restoreAllMocks();
	});

	it('reports the maximum available count when the pool is too small', async () => {
		findActiveQuestionsForQuizMock.mockResolvedValue([question('only')]);
		await expect(
			assembleMcqQuiz(
				{ apClass: 'AP Biology', unit: 'Unit 1', count: 10 },
				{ globalFlagEnabled: true }
			)
		).rejects.toMatchObject({
			name: 'QuizPoolWarmingError',
			availableCount: 1,
			message:
				'Not enough active questions are available for a 10-question quiz. Maximum available: 1.'
		});
	});

	it('serves existing stimulus questions from units outside the generation allowlist', async () => {
		findActiveQuestionsForQuizMock.mockResolvedValue([{ ...question('u4', 0), unit: 'Unit 4' }]);
		const result = await assembleMcqQuiz(
			{ apClass: 'AP Biology', unit: 'Unit 4', count: 1 },
			{ globalFlagEnabled: true }
		);
		expect(result.questions[0]?.questionId).toBe('u4');
		expect(result.metrics.stimulusTargetQuestionCount).toBe(0);
		expect(logger.info).toHaveBeenCalledWith(
			'Quiz stimulus target deviation',
			expect.objectContaining({
				apClass: 'AP Biology',
				unit: 'Unit 4',
				stimulusTargetQuestionCount: 0,
				stimulusQuestionCount: 1,
				stimulusTargetDeviation: 1
			})
		);
	});
});
