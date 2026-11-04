import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
	persist: vi.fn(),
	question: vi.fn(),
	capture: vi.fn()
}));

vi.mock('#lib/auth/route-helpers.server.js', () => ({
	withAuthedHandler:
		(handler: (event: RequestEvent, userId: string) => Promise<Response>) =>
		(event: RequestEvent) =>
			handler(event, 'student-1')
}));
vi.mock('#lib/users/attempt-write.server.js', () => ({
	AttemptContextConflictError: class extends Error {},
	persistQuestionAttempt: mocks.persist
}));
vi.mock('#lib/question-bank/mcq/repository.server.js', () => ({ getQuestionById: mocks.question }));
vi.mock('#lib/server/posthog.js', () => ({ capturePostHogServerEvent: mocks.capture }));
vi.mock('#lib/users/practice-context.server.js', () => ({ requirePracticeSession: vi.fn() }));

import { POST } from '../../../src/routes/api/me/record-attempt/+server.js';

function event(body: unknown): RequestEvent {
	return {
		request: new Request('https://example.com/api/me/record-attempt', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as RequestEvent;
}

describe('record attempt API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.question.mockResolvedValue({ course: 'AP Biology', unit: 'Unit 1', correctAnswer: 'B' });
	});

	it('returns the same response for an idempotent retry and emits analytics only once', async () => {
		mocks.persist
			.mockResolvedValueOnce({ mastery: 75, totalAttempts: 4, newlyRecorded: true })
			.mockResolvedValueOnce({ mastery: 75, totalAttempts: 4, newlyRecorded: false });
		const payload = {
			questionId: 'question-1',
			selectedAnswer: 'b',
			timeTakenMs: 1200,
			attemptId: '019fe8b0-0000-7000-8000-000000000001'
		};
		const first = await POST(event(payload));
		const retry = await POST(event(payload));
		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({
			message: 'Attempt recorded successfully',
			questionId: 'question-1',
			mastery: 75,
			totalAttempts: 4
		});
		expect(await retry.json()).toEqual({
			message: 'Attempt recorded successfully',
			questionId: 'question-1',
			mastery: 75,
			totalAttempts: 4
		});
		expect(mocks.capture).toHaveBeenCalledOnce();
		expect(mocks.capture).toHaveBeenCalledWith(
			expect.any(Request),
			expect.objectContaining({
				distinctId: 'student-1',
				event: 'question_attempt_recorded',
				properties: expect.objectContaining({ question_id: 'question-1', was_correct: true })
			})
		);
	});

	it('maps missing question metadata to a 404 without analytics', async () => {
		mocks.question.mockResolvedValue(null);
		const response = await POST(event({ questionId: 'missing', selectedAnswer: 'A' }));
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: 'Question metadata was not found' });
		expect(mocks.persist).not.toHaveBeenCalled();
		expect(mocks.capture).not.toHaveBeenCalled();
	});
});
