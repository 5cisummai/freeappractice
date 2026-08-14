import { afterEach, describe, expect, it, vi } from 'vitest';
import { PoolWarmingError } from '$lib/questions/request.client';
import { requestFrqQuestion, requestMcqQuestion } from '$lib/questions/request.client';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const mcqPayload = {
	questionId: 'mcq-1',
	cached: true,
	exclusionsReset: true,
	question: 'What is 2 + 2?',
	options: [
		{ id: 'A', text: '3' },
		{ id: 'B', text: '4' }
	],
	correctAnswer: 'B'
};

const frqPayload = {
	question: {
		questionId: 'frq-1',
		schemaVersion: 1,
		formatId: 'short-answer',
		profileVersion: 'biology-v1',
		promptVersion: 'prompt-v1',
		rubricVersion: 'rubric-v1',
		prompt: 'Explain the result.',
		materials: [],
		sections: [
			{
				id: 'a',
				label: 'A',
				prompt: 'Explain.',
				responseKind: 'text',
				maxPoints: 1
			}
		],
		totalPoints: 1,
		topicsCovered: 'Cells',
		apClass: 'AP Biology',
		unit: 'Unit 1'
	},
	cached: false
};

describe('question request transport', () => {
	it('keeps MCQ and FRQ warming errors on the same neutral type', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							code: 'POOL_WARMING',
							error: 'Try again soon.',
							retryAfterSeconds: 2.8
						}),
						{ status: 503 }
					)
			)
		);

		const mcqError = await requestMcqQuestion('AP Biology', 'Unit 1').catch((error) => error);
		const frqError = await requestFrqQuestion('AP Biology', 'Unit 1').catch((error) => error);

		expect(mcqError).toBeInstanceOf(PoolWarmingError);
		expect(frqError).toBeInstanceOf(PoolWarmingError);
		expect(mcqError.retryAfterSeconds).toBe(2);
		expect(frqError.retryAfterSeconds).toBe(2);
	});

	it('shapes MCQ and FRQ success results consistently', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(mcqPayload), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify(frqPayload), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		const mcq = await requestMcqQuestion('AP Biology', 'Unit 1', ['old-mcq']);
		const frq = await requestFrqQuestion('AP Biology', 'Unit 1', ['old-frq']);

		expect(mcq).toMatchObject({ source: 'cached', exclusionsReset: true });
		expect(mcq.question.prompt).toBe('What is 2 + 2?');
		expect(frq).toMatchObject({ source: 'generated', exclusionsReset: false });
		expect(frq.question.questionId).toBe('frq-1');
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			'/api/question',
			expect.objectContaining({ body: expect.stringContaining('old-mcq') })
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'/api/question/frq',
			expect.objectContaining({ body: expect.stringContaining('old-frq') })
		);
	});
});
