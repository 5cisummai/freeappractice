import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuestionById } = vi.hoisted(() => ({
	getQuestionById: vi.fn()
}));

vi.mock('$lib/question-bank/mcq/repository.server', () => ({ getQuestionById }));

import { GET } from '../../../../src/routes/api/question/by-id/[questionId]/+server';

describe('GET /api/question/by-id/[questionId]', () => {
	beforeEach(() => {
		getQuestionById.mockReset();
	});

	it('returns the question without the answer key or explanation', async () => {
		getQuestionById.mockResolvedValueOnce({
			id: 'q-1',
			question: 'Q?',
			optionA: 'A',
			optionB: 'B',
			optionC: 'C',
			optionD: 'D',
			correctAnswer: 'D',
			explanation: 'Because D',
			mainTopic: 'Cells',
			topicsCovered: 'Cells',
			diagramSpec: null,
			hasDiagram: false
		});

		const response = await GET({
			params: { questionId: 'q-1' }
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.questionId).toBe('q-1');
		expect(body.answer).toMatchObject({ question: 'Q?', optionD: 'D' });
		expect(body.answer).not.toHaveProperty('correctAnswer');
		expect(body.answer).not.toHaveProperty('explanation');
	});
});
