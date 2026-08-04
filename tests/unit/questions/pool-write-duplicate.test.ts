import { beforeEach, describe, expect, it, vi } from 'vitest';

const { QuestionCreate, generateAPQuestion, recordRecentTopic, getRecentTopics } = vi.hoisted(
	() => ({
		QuestionCreate: vi.fn(),
		generateAPQuestion: vi.fn(),
		recordRecentTopic: vi.fn(async () => {}),
		getRecentTopics: vi.fn(async () => [])
	})
);

vi.mock('$lib/questions/cache-model.server', () => ({
	Question: { create: QuestionCreate },
	newPoolRandomKey: () => 0.42
}));

vi.mock('$lib/questions/generation.server', () => ({
	generateAPQuestion
}));

vi.mock('$lib/questions/recent-topic.server', () => ({
	getRecentTopics,
	recordRecentTopic
}));

vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { generateQuestionForPool } from '$lib/questions/pool-write.server';

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
		QuestionCreate.mockReset();
		generateAPQuestion.mockReset();
		recordRecentTopic.mockClear();
		getRecentTopics.mockClear();
	});

	it('marks skippedDuplicate when Mongo reports a duplicate key', async () => {
		generateAPQuestion.mockResolvedValueOnce({
			answer: sampleAnswer,
			questionId: 'q-dup-1',
			provider: 'openai',
			model: 'test',
			timing: { generationMs: 10, persistenceMs: 5 }
		});
		QuestionCreate.mockRejectedValueOnce({ code: 11000 });

		const result = await generateQuestionForPool('AP Biology', 'Unit 1');

		expect(result.skippedDuplicate).toBe(true);
		expect(result.questionId).toBe('q-dup-1');
		expect(QuestionCreate).toHaveBeenCalledOnce();
	});

	it('rethrows non-duplicate insert failures', async () => {
		generateAPQuestion.mockResolvedValueOnce({
			answer: sampleAnswer,
			questionId: 'q-fail-1',
			provider: 'openai',
			model: 'test',
			timing: { generationMs: 10, persistenceMs: 5 }
		});
		QuestionCreate.mockRejectedValueOnce(new Error('mongo write failed'));

		await expect(generateQuestionForPool('AP Biology', 'Unit 1')).rejects.toThrow(
			'mongo write failed'
		);
	});
});
