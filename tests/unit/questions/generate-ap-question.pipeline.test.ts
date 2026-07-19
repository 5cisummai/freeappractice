import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateTextMock, saveQuestionToS3, recordMcqGenerated } = vi.hoisted(() => ({
	generateTextMock: vi.fn(),
	saveQuestionToS3: vi.fn(async () => 'persisted-question-id'),
	recordMcqGenerated: vi.fn(async () => {})
}));

vi.mock('$env/static/private', () => ({
	OPEN_AI_KEY: 'test-key'
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		GENERATION_MODEL: 'test-generation-model',
		TUTOR_MODEL: 'test-tutor-model',
		OPENAI_BASE_URL: 'https://api.openai.com/v1'
	}
}));

vi.mock('ai', async (importOriginal) => {
	const actual = await importOriginal<typeof import('ai')>();
	return {
		...actual,
		generateText: generateTextMock
	};
});

vi.mock('$lib/questions/storage.server', () => ({
	saveQuestionToS3
}));

vi.mock('$lib/questions/gen-stats.server', () => ({
	recordMcqGenerated
}));

vi.mock('$lib/server/logger', () => ({
	logger: {
		aiCall: () => () => {},
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn()
	}
}));

import { generateAPQuestion } from '$lib/questions/generation.server';

const validGeneratedQuestion = {
	question: 'Which agricultural practice is most associated with intensive subsistence farming?',
	optionA: 'Nomadic herding across arid steppes',
	optionB: 'Wet-rice cultivation on small plots',
	optionC: 'Ranching on extensive grasslands',
	optionD: 'Plantation monoculture for export',
	correctAnswer: 'B' as const,
	explanation: 'Intensive subsistence farming often centers on wet-rice cultivation.',
	hint1: 'Think about high labor input on small parcels of land.',
	hint2: 'Consider East and South Asian rice paddies rather than cattle ranching.',
	topicsCovered: 'Intensive subsistence agriculture and wet-rice farming patterns'
};

describe('MCQ live generation pipeline', () => {
	beforeEach(() => {
		generateTextMock.mockReset();
		saveQuestionToS3.mockReset();
		saveQuestionToS3.mockResolvedValue('persisted-question-id');
		recordMcqGenerated.mockReset();
		recordMcqGenerated.mockResolvedValue(undefined);
	});

	it('runs generateAPQuestion end-to-end: schema-safe AI output → S3 persist → result', async () => {
		generateTextMock.mockResolvedValue({
			output: validGeneratedQuestion,
			usage: { inputTokens: 10, outputTokens: 20 }
		});

		const result = await generateAPQuestion({
			className: 'AP Human Geography',
			unit: 'Unit 5: Agriculture and Rural Land-Use Patterns and Processes'
		});

		expect(generateTextMock).toHaveBeenCalledTimes(1);
		expect(saveQuestionToS3).toHaveBeenCalledTimes(1);
		expect(saveQuestionToS3).toHaveBeenCalledWith(
			expect.objectContaining({
				question: validGeneratedQuestion.question,
				hint1: validGeneratedQuestion.hint1,
				hint2: validGeneratedQuestion.hint2,
				apClass: 'AP Human Geography',
				unit: 'Unit 5: Agriculture and Rural Land-Use Patterns and Processes'
			})
		);
		expect(result.questionId).toBe('persisted-question-id');
		expect(result.answer.hint1).toBe(validGeneratedQuestion.hint1);
		expect(result.answer.hint2).toBe(validGeneratedQuestion.hint2);
		expect(result.provider).toBe('ai');
		expect(result.model).toBe('test-generation-model');
		expect(result.timing?.generationMs).toBeGreaterThanOrEqual(0);
		expect(result.timing?.persistenceMs).toBeGreaterThanOrEqual(0);
	});

	it('surfaces persistence failures as QuestionGenerationError after a successful model response', async () => {
		generateTextMock.mockResolvedValue({
			output: validGeneratedQuestion,
			usage: { inputTokens: 1, outputTokens: 1 }
		});
		saveQuestionToS3.mockRejectedValueOnce(new Error('S3 unavailable'));

		await expect(
			generateAPQuestion({
				className: 'AP Biology',
				unit: 'Unit 1'
			})
		).rejects.toMatchObject({
			name: 'QuestionGenerationError',
			message: 'Failed to persist generated question'
		});
	});
});
