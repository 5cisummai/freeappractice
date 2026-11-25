import { describe, expect, it, vi } from 'vitest';
import { prepareEveContinuation } from '#lib/agent/eve-continuation.server.js';

vi.mock('#lib/question-bank/mcq/repository.server.js', () => ({
	getQuestionById: vi.fn(async () => ({ course: 'AP Biology', correctAnswer: 'B' }))
}));

const question = {
	kind: 'practice_question',
	mode: 'mcq',
	questionId: 'question-id',
	course: 'AP Biology',
	unit: 'Unit 1',
	practiceHref: '/app/practice',
	prompt: 'Practice stem'
};
const storedPart = {
	type: 'tool-give_practice_question',
	state: 'input-available',
	toolCallId: 'tool-call',
	input: { course: question.course, mode: 'mcq' },
	assignedQuestion: question
};
const base = {
	stored: {
		id: 'assistant-id',
		role: 'assistant' as const,
		content: '',
		parts: [storedPart],
		position: 1,
		status: 'complete'
	},
	storedPart,
	event: {} as never,
	userId: 'user-id',
	sessionId: 'session-id',
	conversationId: 'conversation-id'
};

describe('Coach practice continuation', () => {
	it('grades the assigned MCQ without trusting client correctness or requiring an attempt row', async () => {
		const result = await prepareEveContinuation({
			...base,
			submitted: {
				state: 'output-available',
				output: { ...question, status: 'answered', selectedAnswer: 'A', isCorrect: true }
			}
		});
		expect(result?.chunk).toMatchObject({
			type: 'tool-output-available',
			output: { selectedAnswer: 'A', isCorrect: false }
		});
		expect(result?.context).not.toContain('correctAnswer');
	});

	it('rejects an answer to a different question', async () => {
		await expect(
			prepareEveContinuation({
				...base,
				submitted: {
					state: 'output-available',
					output: { ...question, questionId: 'other-question', status: 'skipped' }
				}
			})
		).resolves.toBeNull();
	});
});
