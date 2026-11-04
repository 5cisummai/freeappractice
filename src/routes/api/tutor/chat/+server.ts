import type { RequestHandler } from './$types';
import { getOptionalUserId } from '#lib/auth/route-helpers.server.js';
import { buildMcqTutorSystem, resolveTutorQuestion } from '#lib/tutor/service.server.js';
import { capturePostHogServerEvent } from '#lib/server/posthog.js';
import { logger } from '#lib/server/logger.js';
import { limitGenericTutor } from '#lib/tutor/rate-limit.server.js';
import { readJsonBody, RequestBodyTooLargeError } from '#lib/server/request-body.server.js';
import { createTutorStreamResponse } from '#lib/tutor/chat-response.server.js';
import { MAX_TUTOR_CHAT_REQUEST_BYTES, tutorChatRequestSchema } from '#lib/tutor/chat-request.js';
import { tutorRateLimitedResponse } from '#lib/tutor/response-utils.server.js';
import { getAssistantFeaturesEnabledForRequest } from '#lib/users/assistant-preferences.server.js';
import type { UIMessage } from 'ai';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	try {
		const userId = await getOptionalUserId(event);
		if (userId && !(await getAssistantFeaturesEnabledForRequest(event.locals, userId))) {
			return Response.json(
				{ error: 'Assistant features are disabled for this account.' },
				{ status: 403 }
			);
		}
		let body: unknown;
		try {
			body = await readJsonBody(request, MAX_TUTOR_CHAT_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return Response.json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return Response.json({ error: 'Tutor chat request must be valid JSON' }, { status: 400 });
		}

		const result = tutorChatRequestSchema.safeParse(body);
		if (!result.success) {
			return Response.json(
				{
					error: 'Invalid tutor chat request',
					details: result.error.issues.map((issue) => issue.message)
				},
				{ status: 400 }
			);
		}

		const question = await resolveTutorQuestion(result.data.questionId);
		if (!question) return Response.json({ error: 'Question not found' }, { status: 404 });

		const rate = await limitGenericTutor(request, userId);
		if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);

		const userTurns = result.data.messages.filter((message) => message.role === 'user').length;
		capturePostHogServerEvent(request, {
			distinctId: userId ?? 'anonymous',
			event: 'tutor_chat_started',
			properties: {
				course: question.course,
				unit: question.unit,
				has_prior_conversation: userTurns > 1,
				personalized: false
			}
		});

		return createTutorStreamResponse({
			operation: 'chat',
			system: buildMcqTutorSystem({
				question: question.question,
				correctAnswer: question.correctAnswer,
				explanation: question.explanation,
				course: question.course ?? '',
				unit: question.unit ?? '',
				answerChoices: {
					A: question.optionA,
					B: question.optionB,
					C: question.optionC,
					D: question.optionD
				}
			}),
			messages: result.data.messages as UIMessage[],
			signal: request.signal,
			logMeta: { historyLength: result.data.messages.length },
			headers: {
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (error) {
		logger.error('Tutor chat error', { error });
		return Response.json({ error: 'Failed to start tutor chat' }, { status: 500 });
	}
};
