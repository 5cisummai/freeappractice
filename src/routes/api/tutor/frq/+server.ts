import type { RequestHandler } from './$types';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { requireFrqPracticeEnabled } from '#lib/question-bank/frq/gate.server.js';
import { getFrqAttemptForUser } from '#lib/grading/frq/attempts.server.js';
import { getFrqCourseProfile } from '#lib/question-bank/frq/profiles.server.js';
import { getFrqQuestionById } from '#lib/question-bank/frq/model.server.js';
import { buildFrqTutorSystem } from '#lib/tutor/service.server.js';
import { createTutorStreamResponse } from '#lib/tutor/chat-response.server.js';
import {
	frqTutorChatRequestSchema,
	MAX_TUTOR_CHAT_REQUEST_BYTES
} from '#lib/tutor/chat-request.js';
import { capturePostHogServerEvent } from '#lib/server/posthog.js';
import { limitGenericTutor } from '#lib/tutor/rate-limit.server.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';
import { tutorRateLimitedResponse } from '#lib/tutor/response-utils.server.js';
import { getAssistantFeaturesEnabledForRequest } from '#lib/users/assistant-preferences.server.js';
import type { UIMessage } from 'ai';

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		if (!(await getAssistantFeaturesEnabledForRequest(event.locals, userId))) {
			return Response.json(
				{ error: 'Assistant features are disabled for this account.' },
				{ status: 403 }
			);
		}

		let body: unknown;
		try {
			body = await readJsonBody(event.request, MAX_TUTOR_CHAT_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return Response.json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return Response.json({ error: 'Invalid tutor chat request' }, { status: 400 });
		}

		const result = frqTutorChatRequestSchema.safeParse(body);
		if (!result.success) {
			return Response.json(
				{
					error: 'Invalid tutor chat request',
					details: result.error.issues.map((issue) => issue.message)
				},
				{ status: 400 }
			);
		}

		const question = await getFrqQuestionById(result.data.questionId);
		if (!getFrqCourseProfile(question.course)) {
			return Response.json(
				{ error: 'Written-response practice is unavailable for this course' },
				{ status: 404 }
			);
		}

		let attempt = null;
		if (result.data.attemptId) {
			attempt = await getFrqAttemptForUser(userId, result.data.attemptId);
			if (!attempt || attempt.questionId !== result.data.questionId) {
				return Response.json({ error: 'Written-response attempt not found' }, { status: 404 });
			}
		}

		const rate = await limitGenericTutor(event.request, userId);
		if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);

		const userTurns = result.data.messages.filter((message) => message.role === 'user').length;
		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'frq_tutor_chat_started',
			properties: {
				course: question.course,
				unit: question.unit,
				has_submission: Boolean(attempt),
				has_prior_conversation: userTurns > 1,
				personalized: false
			}
		});

		return createTutorStreamResponse({
			operation: 'chatFrq',
			system: buildFrqTutorSystem({ question, attempt }),
			messages: result.data.messages as UIMessage[],
			signal: event.request.signal,
			logMeta: { historyLength: result.data.messages.length, course: question.course },
			headers: {
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	},
	{ logLabel: 'FRQ tutor chat error', errorMessage: 'Failed to start FRQ tutor chat' }
);
