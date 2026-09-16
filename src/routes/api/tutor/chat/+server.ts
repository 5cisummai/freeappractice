import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOptionalUserId } from '$lib/auth/route-helpers.server';
import { resolveTutorQuestion } from '$lib/tutor/service.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { logger } from '$lib/server/logger';
import { limitGenericTutor } from '$lib/super/ai-controls.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createTutorChatStream } from '$lib/tutor/chat-stream.server';
import { MAX_TUTOR_CHAT_REQUEST_BYTES, tutorChatRequestSchema } from '$lib/tutor/chat-request';
import { tutorRateLimitedResponse } from '$lib/tutor/response-utils.server';
import { chat } from '$lib/tutor/service.server';
import { getAssistantFeaturesEnabledForRequest } from '$lib/super/assistant.server';

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	try {
		const userId = await getOptionalUserId(event);
		if (userId && !(await getAssistantFeaturesEnabledForRequest(event.locals, userId))) {
			return json({ error: 'Assistant features are disabled for this account.' }, { status: 403 });
		}
		let body: unknown;
		try {
			body = await readJsonBody(request, MAX_TUTOR_CHAT_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return json({ error: 'Tutor chat request must be valid JSON' }, { status: 400 });
		}

		const result = tutorChatRequestSchema.safeParse(body);
		if (!result.success) {
			return json(
				{
					error: 'Invalid tutor chat request',
					details: result.error.issues.map((issue) => issue.message)
				},
				{ status: 400 }
			);
		}

		const question = await resolveTutorQuestion(result.data.questionId);
		if (!question) return json({ error: 'Question not found' }, { status: 404 });

		const rate = await limitGenericTutor(request, userId);
		if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);

		capturePostHogServerEvent(request, {
			distinctId: userId ?? 'anonymous',
			event: 'tutor_chat_started',
			properties: {
				ap_class: question.apClass,
				unit: question.unit,
				has_prior_conversation: result.data.conversationHistory.length > 0,
				personalized: false
			}
		});

		const stream = createTutorChatStream(
			{
				question: question.question,
				correctAnswer: question.correctAnswer,
				explanation: question.explanation,
				apClass: question.apClass ?? '',
				unit: question.unit ?? '',
				answerChoices: {
					A: question.optionA,
					B: question.optionB,
					C: question.optionC,
					D: question.optionD
				}
			},
			result.data,
			request.signal,
			{ chatImpl: chat }
		);

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (error) {
		logger.error('Tutor chat error', { error });
		return json({ error: 'Failed to start tutor chat' }, { status: 500 });
	}
};
