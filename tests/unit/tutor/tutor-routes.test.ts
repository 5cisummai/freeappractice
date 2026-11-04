import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getOptionalUserId: vi.fn(),
	getAssistantFeaturesEnabledForRequest: vi.fn(),
	resolveTutorQuestion: vi.fn(),
	limitGenericTutor: vi.fn(),
	createTutorStreamResponse: vi.fn(),
	getFrqQuestionById: vi.fn(),
	getFrqCourseProfile: vi.fn(),
	getFrqAttemptForUser: vi.fn(),
	requireFrqPracticeEnabled: vi.fn()
}));

vi.mock('#lib/auth/route-helpers.server.js', () => ({
	getOptionalUserId: mocks.getOptionalUserId,
	withAuthedHandler:
		(handler: (event: unknown, userId: string) => Promise<Response>) => (event: unknown) =>
			handler(event, 'user-1')
}));
vi.mock('#lib/users/assistant-preferences.server.js', () => ({
	getAssistantFeaturesEnabledForRequest: mocks.getAssistantFeaturesEnabledForRequest
}));
vi.mock('#lib/tutor/service.server.js', () => ({
	resolveTutorQuestion: mocks.resolveTutorQuestion,
	buildMcqTutorSystem: vi.fn(() => 'system'),
	buildFrqTutorSystem: vi.fn(() => 'system')
}));
vi.mock('#lib/tutor/rate-limit.server.js', () => ({
	limitGenericTutor: mocks.limitGenericTutor
}));
vi.mock('#lib/tutor/chat-response.server.js', () => ({
	createTutorStreamResponse: mocks.createTutorStreamResponse
}));
vi.mock('#lib/question-bank/frq/model.server.js', () => ({
	getFrqQuestionById: mocks.getFrqQuestionById
}));
vi.mock('#lib/question-bank/frq/profiles.server.js', () => ({
	getFrqCourseProfile: mocks.getFrqCourseProfile
}));
vi.mock('#lib/grading/frq/attempts.server.js', () => ({
	getFrqAttemptForUser: mocks.getFrqAttemptForUser
}));
vi.mock('#lib/question-bank/frq/gate.server.js', () => ({
	requireFrqPracticeEnabled: mocks.requireFrqPracticeEnabled
}));
vi.mock('#lib/server/posthog.js', () => ({ capturePostHogServerEvent: vi.fn() }));
vi.mock('#lib/server/logger.js', () => ({ logger: { error: vi.fn() } }));

import { POST as tutorChatPost } from '../../../src/routes/api/tutor/chat/+server';
import { POST as tutorFrqPost } from '../../../src/routes/api/tutor/frq/+server';

const sessionId = 'c8f3048f-1681-47f2-b1db-e912655275d0';
const questionId = 'd8f3048f-1681-47f2-b1db-e912655275d1';

const tutorMessages = [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Help' }] }];

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
	vi.clearAllMocks();
	mocks.getOptionalUserId.mockResolvedValue('user-1');
	mocks.getAssistantFeaturesEnabledForRequest.mockResolvedValue(true);
	mocks.limitGenericTutor.mockResolvedValue({ allowed: true, retryAt: null });
	mocks.requireFrqPracticeEnabled.mockResolvedValue(null);
	mocks.createTutorStreamResponse.mockResolvedValue(new Response(null, { status: 200 }));
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
		expect(mocks.createTutorStreamResponse).not.toHaveBeenCalled();
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
		expect(mocks.createTutorStreamResponse).not.toHaveBeenCalled();
	});

	it('accepts generic tutor chat bodies', async () => {
		mocks.resolveTutorQuestion.mockResolvedValue({
			question: 'Q',
			correctAnswer: 'A',
			explanation: 'E',
			course: 'AP Bio',
			unit: 'Unit 1',
			optionA: 'a',
			optionB: 'b',
			optionC: 'c',
			optionD: 'd'
		});

		const response = await tutorChatPost({
			request: new Request('https://app.test/api/tutor/chat', {
				method: 'POST',
				body: JSON.stringify({
					questionId,
					messages: tutorMessages
				}),
				headers: { 'content-type': 'application/json' }
			}),
			locals: {}
		} as Parameters<typeof tutorChatPost>[0]);

		expect(response.status).toBe(200);
		expect(mocks.createTutorStreamResponse).toHaveBeenCalled();
	});
});

describe('standard tutoring for every plan', () => {
	it.each(['free', 'super'])('uses standard MCQ tutoring for a %s user', async (plan) => {
		mocks.resolveTutorQuestion.mockResolvedValue({
			question: 'Q',
			correctAnswer: 'A',
			explanation: 'E',
			course: 'AP Biology',
			unit: 'Unit 1',
			optionA: 'a',
			optionB: 'b',
			optionC: 'c',
			optionD: 'd'
		});
		const response = await tutorChatPost({
			request: new Request('https://app.test/api/tutor/chat', {
				method: 'POST',
				body: JSON.stringify({ questionId, messages: tutorMessages }),
				headers: { 'content-type': 'application/json' }
			}),
			locals: { planAccess: Promise.resolve({ plan }) }
		} as Parameters<typeof tutorChatPost>[0]);
		expect(response.status).toBe(200);
		expect(mocks.limitGenericTutor).toHaveBeenCalledWith(expect.any(Request), 'user-1');
		expect(mocks.createTutorStreamResponse.mock.calls[0][0]).not.toHaveProperty(
			'personalizationContext'
		);
	});
	it.each(['free', 'super'])('uses standard FRQ tutoring for a %s user', async (plan) => {
		mocks.getFrqQuestionById.mockResolvedValue({ id: questionId, course: 'AP Biology' });
		mocks.getFrqCourseProfile.mockReturnValue({});
		const response = await tutorFrqPost({
			request: new Request('https://app.test/api/tutor/frq', {
				method: 'POST',
				body: JSON.stringify({ questionId, messages: tutorMessages }),
				headers: { 'content-type': 'application/json' }
			}),
			locals: { planAccess: Promise.resolve({ plan }) }
		} as Parameters<typeof tutorFrqPost>[0]);
		expect(response.status).toBe(200);
		expect(mocks.createTutorStreamResponse.mock.calls[0][0]).not.toHaveProperty(
			'personalizationContext'
		);
	});
});
