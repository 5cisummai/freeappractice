import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	assembleMcqQuiz,
	isStimulusQuestionsEnabled,
	limitQuestionPoolRequests,
	requestPoolRefill,
	resolveQuizUnits,
	validateQuestionRequest,
	QuizPoolWarmingError
} = vi.hoisted(() => ({
	assembleMcqQuiz: vi.fn(),
	isStimulusQuestionsEnabled: vi.fn(),
	limitQuestionPoolRequests: vi.fn(),
	requestPoolRefill: vi.fn(),
	resolveQuizUnits: vi.fn(),
	validateQuestionRequest: vi.fn(),
	QuizPoolWarmingError: class extends Error {}
}));

vi.mock('$lib/catalog/question-request.server', () => ({ validateQuestionRequest }));
vi.mock('$lib/server/api-rate-limit.server', () => ({ limitQuestionPoolRequests }));
vi.mock('$lib/flags', () => ({ isStimulusQuestionsEnabled }));
vi.mock('$lib/question-bank/mcq/quiz-assembler.server', () => ({
	assembleMcqQuiz,
	QuizPoolWarmingError,
	resolveQuizUnits
}));
vi.mock('$lib/question-bank/pool-refill-queue.server', () => ({ requestPoolRefill }));
vi.mock('$lib/question-bank/mcq/public-payload.server', () => ({
	generatedQuestionToMcqAnswerBody: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { POST } from '../../../../src/routes/api/question/quiz/+server';

describe('POST /api/question/quiz refill authorization', () => {
	beforeEach(() => {
		assembleMcqQuiz.mockReset();
		isStimulusQuestionsEnabled.mockResolvedValue(false);
		limitQuestionPoolRequests.mockResolvedValue({
			allowed: true,
			retryAt: null,
			limit: 20,
			degraded: false
		});
		requestPoolRefill.mockReset();
		resolveQuizUnits.mockReturnValue(['Unit 1']);
		validateQuestionRequest.mockReturnValue({
			ok: true,
			value: { className: 'AP Biology', unit: 'Unit 1' }
		});
	});

	it('does not enqueue a refill for an anonymous pool miss', async () => {
		assembleMcqQuiz.mockRejectedValueOnce(new QuizPoolWarmingError('warming'));

		const response = await POST({
			request: new Request('http://localhost/api/question/quiz', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ className: 'AP Biology', unit: 'Unit 1', count: 1 })
			}),
			locals: { userId: undefined }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(503);
		expect(requestPoolRefill).not.toHaveBeenCalled();
		expect((await response.json()).refillRequested).toBe(false);
	});

	it('allows an authenticated pool miss to enqueue a refill', async () => {
		assembleMcqQuiz.mockRejectedValueOnce(new QuizPoolWarmingError('warming'));
		requestPoolRefill.mockResolvedValue(undefined);

		const response = await POST({
			request: new Request('http://localhost/api/question/quiz', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ className: 'AP Biology', unit: 'Unit 1', count: 1 })
			}),
			locals: { userId: 'user-1' }
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(503);
		expect(requestPoolRefill).toHaveBeenCalledWith({
			questionType: 'mcq',
			apClass: 'AP Biology',
			unit: 'Unit 1'
		});
		expect((await response.json()).refillRequested).toBe(true);
	});
});
