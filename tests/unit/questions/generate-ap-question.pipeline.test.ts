import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));

vi.mock('$env/static/private', () => ({
	OPEN_AI_KEY: 'test-key'
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
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
	});

	it('runs generateAPQuestion end-to-end without S3 persistence', async () => {
		generateTextMock.mockResolvedValue({
			output: validGeneratedQuestion,
			usage: { inputTokens: 10, outputTokens: 20 }
		});

		const result = await generateAPQuestion({
			className: 'AP Human Geography',
			unit: 'Unit 5: Agriculture and Rural Land-Use Patterns and Processes'
		});

		expect(generateTextMock).toHaveBeenCalledTimes(1);
		expect(result.questionId).toEqual(expect.any(String));
		expect(result.answer.hint1).toBe(validGeneratedQuestion.hint1);
		expect(result.answer.hint2).toBe(validGeneratedQuestion.hint2);
		expect(result.provider).toBe('ai');
		expect(result.model).toBe('gpt-5.6-luna');
		expect(result.timing?.generationMs).toBeGreaterThanOrEqual(0);
		expect(result.timing?.persistenceMs).toBeGreaterThanOrEqual(0);
	});

	it('returns a generated id without persisting the question', async () => {
		generateTextMock.mockResolvedValue({
			output: validGeneratedQuestion,
			usage: { inputTokens: 1, outputTokens: 1 }
		});

		const result = await generateAPQuestion({
			className: 'AP Biology',
			unit: 'Unit 1'
		});

		expect(result).toMatchObject({ answer: validGeneratedQuestion });
		expect(result.questionId).toEqual(expect.any(String));
		expect(result.timing?.persistenceMs).toBe(0);
	});
});
