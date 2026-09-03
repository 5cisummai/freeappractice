import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMany, capturePathQuestionRequestMetric, limitQuestionPoolRequests } = vi.hoisted(() => ({
	getMany: vi.fn(),
	capturePathQuestionRequestMetric: vi.fn(),
	limitQuestionPoolRequests: vi.fn()
}));

vi.mock('$lib/question-bank/mcq/bank.server', () => ({ mcqBank: { getMany } }));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$lib/server/question-request-metrics', () => ({
	createQuestionPathMetrics: () => ({ questionType: 'mcq', dbConnectMs: 0, poolQueryMs: 0 }),
	capturePathQuestionRequestMetric
}));
vi.mock('$lib/server/api-rate-limit.server', () => ({ limitQuestionPoolRequests }));

import { POST } from '../../../../src/routes/api/questions/batch/+server';

describe('POST /api/questions/batch', () => {
	beforeEach(() => {
		getMany.mockReset();
		capturePathQuestionRequestMetric.mockClear();
		limitQuestionPoolRequests.mockResolvedValue({
			allowed: true,
			retryAt: null,
			limit: 20,
			degraded: true
		});
	});

	it('rejects counts outside the bounded batch size', async () => {
		const response = await POST({
			request: new Request('http://localhost/api/questions/batch', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ className: 'AP Biology', unit: 'Unit 1', count: 11 })
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		expect(getMany).not.toHaveBeenCalled();
	});

	it('returns the selected question wrappers in one response', async () => {
		getMany.mockResolvedValueOnce({
			status: 'found',
			exclusionsReset: false,
			results: [
				{
					answer: {
						question: 'Q1',
						optionA: 'A',
						optionB: 'B',
						optionC: 'C',
						optionD: 'D',
						correctAnswer: 'A',
						explanation: 'E',
						mainTopic: 'Cells',
						topicsCovered: 'Cells',
						diagramSpec: null,
						hasDiagram: false
					},
					provider: 'cache',
					model: 'cached',
					cached: true,
					questionId: 'q-1',
					apClass: 'AP Biology',
					unit: 'Unit 1'
				}
			]
		});

		const response = await POST({
			request: new Request('http://localhost/api/questions/batch', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					className: 'AP Biology',
					unit: 'Unit 1',
					count: 1,
					excludeQuestionIds: ['old']
				})
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(getMany).toHaveBeenCalledWith(
			'AP Biology',
			'Unit 1',
			1,
			expect.objectContaining({ excludeQuestionIds: ['old'] })
		);
		expect(await response.json()).toEqual({
			questions: [
				{
					answer: expect.objectContaining({ question: 'Q1', correctAnswer: 'A' }),
					provider: 'cache',
					model: 'cached',
					cached: true,
					questionId: 'q-1'
				}
			],
			exclusionsReset: false
		});
	});
});
