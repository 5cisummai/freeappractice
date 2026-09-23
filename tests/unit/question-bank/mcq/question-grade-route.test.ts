import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuestionsLookupMap } = vi.hoisted(() => ({
	getQuestionsLookupMap: vi.fn()
}));

vi.mock('$lib/question-bank/mcq/repository.server', () => ({ getQuestionsLookupMap }));
vi.mock('$lib/server/logger', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { POST } from '../../../../src/routes/api/question/grade/+server';

function gradeRequest(body: unknown): Request {
	return new Request('http://localhost/api/question/grade', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('POST /api/question/grade', () => {
	beforeEach(() => {
		getQuestionsLookupMap.mockReset();
	});

	it('returns the key and explanation only for a submitted answer', async () => {
		getQuestionsLookupMap.mockResolvedValueOnce(
			new Map([
				[
					'q-1',
					{
						id: 'q-1',
						correctAnswer: 'B',
						explanation: 'Option B matches the stimulus.'
					}
				]
			])
		);

		const response = await POST({
			request: gradeRequest({
				attempts: [{ questionId: 'q-1', selectedAnswer: 'A' }]
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			results: [
				{
					questionId: 'q-1',
					selectedAnswer: 'A',
					isCorrect: false,
					correctAnswer: 'B',
					explanation: 'Option B matches the stimulus.'
				}
			]
		});
		expect(getQuestionsLookupMap).toHaveBeenCalledWith(['q-1']);
	});

	it('does not reveal a key when the question is unknown', async () => {
		getQuestionsLookupMap.mockResolvedValueOnce(new Map());

		const response = await POST({
			request: gradeRequest({
				attempts: [{ questionId: 'missing', selectedAnswer: 'A' }]
			})
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body).toEqual({ error: 'Question not found' });
		expect(body).not.toHaveProperty('correctAnswer');
		expect(body).not.toHaveProperty('explanation');
	});

	it('rejects a payload that does not submit an answer', async () => {
		const response = await POST({
			request: gradeRequest({ attempts: [] })
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
		expect(getQuestionsLookupMap).not.toHaveBeenCalled();
	});
});
