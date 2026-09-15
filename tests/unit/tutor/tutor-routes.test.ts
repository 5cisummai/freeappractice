import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getOptionalUserId: vi.fn(),
	getAssistantFeaturesEnabledForRequest: vi.fn(),
	resolveTutorQuestion: vi.fn(),
	limitGenericTutor: vi.fn(),
	createTutorChatStream: vi.fn(),
	getFrqQuestionById: vi.fn(),
	getFrqCourseProfile: vi.fn(),
	getFrqAttemptForUser: vi.fn(),
	createFrqTutorChatStream: vi.fn(),
	requireFrqPracticeEnabled: vi.fn()
}));

vi.mock('$lib/auth/route-helpers.server', () => ({
	getOptionalUserId: mocks.getOptionalUserId,
	withAuthedHandler: (handler: (event: unknown, userId: string) => Promise<Response>) => (event: unknown) =>
		handler(event, 'user-1')
}));
vi.mock('$lib/super/assistant.server', () => ({
	getAssistantFeaturesEnabledForRequest: mocks.getAssistantFeaturesEnabledForRequest
}));
vi.mock('$lib/tutor/service.server', () => ({
	resolveTutorQuestion: mocks.resolveTutorQuestion,
	chat: vi.fn(),
	chatFrq: vi.fn()
}));
vi.mock('$lib/super/ai-controls.server', () => ({
	limitGenericTutor: mocks.limitGenericTutor
}));
vi.mock('$lib/tutor/chat-stream.server', () => ({
	createTutorChatStream: mocks.createTutorChatStream,
	createFrqTutorChatStream: mocks.createFrqTutorChatStream
}));
vi.mock('$lib/question-bank/frq/model.server', () => ({
	getFrqQuestionById: mocks.getFrqQuestionById
}));
vi.mock('$lib/question-bank/frq/profiles.server', () => ({
	getFrqCourseProfile: mocks.getFrqCourseProfile
}));
vi.mock('$lib/grading/frq/attempts.server', () => ({
	getFrqAttemptForUser: mocks.getFrqAttemptForUser
}));
vi.mock('$lib/question-bank/frq/gate.server', () => ({
	requireFrqPracticeEnabled: mocks.requireFrqPracticeEnabled
}));
vi.mock('$lib/server/posthog', () => ({ capturePostHogServerEvent: vi.fn() }));
vi.mock('$lib/server/logger', () => ({ logger: { error: vi.fn() } }));

import { POST as tutorChatPost } from '../../../src/routes/api/tutor/chat/+server';
import { POST as tutorFrqPost } from '../../../src/routes/api/tutor/frq/+server';

const sessionId = 'c8f3048f-1681-47f2-b1db-e912655275d0';
const questionId = 'd8f3048f-1681-47f2-b1db-e912655275d1';

const superBody = {
	sessionId,
	context: {
		surface: 'question',
		page: 'practice',
		questionId: sessionId,
		questionType: 'mcq'
	},
	messages: [{ role: 'user', parts: [{ type: 'text', text: 'Help me' }] }]
};

beforeEach(() => {
	mocks.getOptionalUserId.mockResolvedValue('user-1');
	mocks.getAssistantFeaturesEnabledForRequest.mockResolvedValue(true);
	mocks.limitGenericTutor.mockResolvedValue({ allowed: true, retryAt: null });
	mocks.requireFrqPracticeEnabled.mockResolvedValue(null);
});

describe('generic tutor routes', () => {
	it('rejects Super Agent bodies on /api/tutor/chat', async () => {
		const response = await tutorChatPost({
			request: new Request('https://app.test/api/tutor/chat', {
				method: 'POST',
				body: JSON.stringify(superBody),
				headers: { 'content-type': 'application/json' }
			}),
			locals: {}
		} as Parameters<typeof tutorChatPost>[0]);

		expect(response.status).toBe(400);
		expect(mocks.createTutorChatStream).not.toHaveBeenCalled();
	});

	it('rejects Super Agent bodies on /api/tutor/frq', async () => {
		const response = await tutorFrqPost({
			request: new Request('https://app.test/api/tutor/frq', {
				method: 'POST',
				body: JSON.stringify({
					...superBody,
					context: {
						...superBody.context,
						questionType: 'frq'
					}
				}),
				headers: { 'content-type': 'application/json' }
			}),
			locals: {}
		} as Parameters<typeof tutorFrqPost>[0]);

		expect(response.status).toBe(400);
		expect(mocks.createFrqTutorChatStream).not.toHaveBeenCalled();
	});

	it('accepts generic tutor chat bodies', async () => {
		mocks.resolveTutorQuestion.mockResolvedValue({
			question: 'Q',
			correctAnswer: 'A',
			explanation: 'E',
			apClass: 'AP Bio',
			unit: 'Unit 1',
			optionA: 'a',
			optionB: 'b',
			optionC: 'c',
			optionD: 'd'
		});
		mocks.createTutorChatStream.mockReturnValue(new ReadableStream());

		const response = await tutorChatPost({
			request: new Request('https://app.test/api/tutor/chat', {
				method: 'POST',
				body: JSON.stringify({
					questionId,
					message: 'Help',
					conversationHistory: []
				}),
				headers: { 'content-type': 'application/json' }
			}),
			locals: {}
		} as Parameters<typeof tutorChatPost>[0]);

		expect(response.status).toBe(200);
		expect(mocks.createTutorChatStream).toHaveBeenCalled();
	});
});
