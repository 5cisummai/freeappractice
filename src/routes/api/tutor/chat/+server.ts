import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/auth/server';
import { resolveTutorQuestion } from '$lib/tutor/resolve-question.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { logger } from '$lib/server/logger';
import { limitGenericTutor } from '$lib/super/ai-controls.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createTutorChatStream } from '$lib/tutor/chat-stream.server';
import { MAX_TUTOR_CHAT_REQUEST_BYTES, tutorChatRequestSchema } from '$lib/tutor/chat-request';
import { tutorRateLimitedResponse } from '$lib/tutor/response-utils.server';
import { chat } from '$lib/tutor/service.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-stream.server';
import {
	MAX_SUPER_AGENT_REQUEST_BYTES,
	superAgentRequestSchema,
	toSuperAgentContext
} from '$lib/super/agent-request';
import { getAssistantFeaturesEnabledForRequest } from '$lib/users/assistant-features.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';

async function getOptionalUserId(
	event: Parameters<RequestHandler>[0]
): Promise<string | undefined> {
	if (event.locals.userId) return event.locals.userId;
	const session = await auth.api.getSession({ headers: event.request.headers });
	return session?.user?.id;
}

export const POST: RequestHandler = async (event) => {
	const { request } = event;
	try {
		const userId = await getOptionalUserId(event);
		if (userId && !(await getAssistantFeaturesEnabledForRequest(event.locals, userId))) {
			return json({ error: 'Assistant features are disabled for this account.' }, { status: 403 });
		}
		let body: unknown;
		try {
			body = await readJsonBody(request, MAX_SUPER_AGENT_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return json({ error: 'Tutor chat request must be valid JSON' }, { status: 400 });
		}

		const superRequest = superAgentRequestSchema.safeParse(body);
		if (superRequest.success && superRequest.data.context.mode === 'question') {
			if (!userId) return json({ error: 'Authentication required' }, { status: 401 });
			const access = await authorizeFeatureRequest(event, userId, 'personalizedTutor');
			if (!access.allowed) return json({ error: access.message }, { status: access.status });
			if (
				superRequest.data.context.questionType !== 'mcq' ||
				!superRequest.data.context.questionId
			) {
				return json({ error: 'A current question is required for Super Tutor.' }, { status: 400 });
			}
			try {
				return await createSuperAgentStreamResponse({
					event,
					userId,
					sessionId: superRequest.data.sessionId,
					context: toSuperAgentContext(superRequest.data.context),
					messages: superRequest.data.messages,
					surface: 'question',
					errorLabel: 'Super Tutor'
				});
			} catch (error) {
				logger.error('Super Tutor chat error', { error });
				return json({ error: 'Failed to start Super Tutor' }, { status: 500 });
			}
		}

		const result = tutorChatRequestSchema.safeParse(body);
		if (Buffer.byteLength(JSON.stringify(body)) > MAX_TUTOR_CHAT_REQUEST_BYTES) {
			return json({ error: 'Tutor chat request is too large' }, { status: 413 });
		}
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
