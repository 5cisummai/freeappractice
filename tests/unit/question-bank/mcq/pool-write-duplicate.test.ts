import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createCanonicalMcqQuestion, generateAPQuestion, getRecentTopics } = vi.hoisted(() => ({
	createCanonicalMcqQuestion: vi.fn(),
	generateAPQuestion: vi.fn(),
	getRecentTopics: vi.fn(async () => [])
}));

vi.mock('$lib/question-bank/mcq/repository.server', () => ({
	createCanonicalMcqQuestion,
	newPoolRandomKey: () => 0.42
}));

vi.mock('$lib/question-bank/mcq/generation.server', () => ({
	generateAPQuestion
}));

vi.mock('$lib/question-bank/recent-topic.server', () => ({
	getRecentTopics
}));

vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { generateQuestionForPool } from '$lib/question-bank/mcq/write.server';

const sampleAnswer = {
	question: 'What is photosynthesis?',
	optionA: 'A',
	optionB: 'B',
	optionC: 'C',
	optionD: 'D',
	correctAnswer: 'A' as const,
	explanation: 'Because light.',
	topicsCovered: 'energy',
	hint1: 'h1',
	hint2: 'h2'
};

describe('generateQuestionForPool duplicate insertion', () => {
	beforeEach(() => {
		createCanonicalMcqQuestion.mockReset();
		generateAPQuestion.mockReset();
		getRecentTopics.mockClear();
	});

	it('marks skippedDuplicate when Postgres reports a unique violation', async () => {
		generateAPQuestion.mockResolvedValueOnce({
			answer: sampleAnswer,
			questionId: 'q-dup-1',
			provider: 'openai',
			model: 'test',
			timing: { generationMs: 10, persistenceMs: 5 }
		});
		createCanonicalMcqQuestion.mockRejectedValueOnce({ code: '23505' });

		const result = await generateQuestionForPool('AP Biology', 'Unit 1');

		expect(result.skippedDuplicate).toBe(true);
		expect(result.questionId).toBe('q-dup-1');
		expect(createCanonicalMcqQuestion).toHaveBeenCalledOnce();
	});

	it('rethrows non-duplicate insert failures', async () => {
		generateAPQuestion.mockResolvedValueOnce({
			answer: sampleAnswer,
			questionId: 'q-fail-1',
			provider: 'openai',
			model: 'test',
			timing: { generationMs: 10, persistenceMs: 5 }
		});
		createCanonicalMcqQuestion.mockRejectedValueOnce(new Error('pool write failed'));

		await expect(generateQuestionForPool('AP Biology', 'Unit 1')).rejects.toThrow(
			'pool write failed'
		);
	});
});
