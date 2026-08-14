import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { requireFrqPracticeEnabled } from '$lib/frq/gate.server';
import { getFrqAttemptForUser } from '$lib/frq/attempts.server';
import { getFrqCourseProfile } from '$lib/frq/profiles.server';
import { getFrqQuestionById } from '$lib/frq/model.server';
import { chatFrq } from '$lib/tutor/service.server';
import { createFrqTutorChatStream } from '$lib/tutor/chat-stream.server';
import {
	frqTutorChatRequestSchema,
	MAX_TUTOR_CHAT_REQUEST_BYTES,
	TUTOR_CHAT_STREAM_TIMEOUT_MS
} from '$lib/tutor/chat-request';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { logger } from '$lib/server/logger';
import { limitGenericTutor } from '$lib/super/ai-controls.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { tutorRateLimitedResponse } from '$lib/tutor/response-utils.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-stream.server';
import {
	MAX_SUPER_AGENT_REQUEST_BYTES,
	superAgentRequestSchema,
	toSuperAgentContext
} from '$lib/super/agent-request';
import { getAssistantFeaturesEnabledForRequest } from '$lib/super/assistant.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		if (!(await getAssistantFeaturesEnabledForRequest(event.locals, userId))) {
			return json({ error: 'Assistant features are disabled for this account.' }, { status: 403 });
		}

		let body: unknown;
		try {
			body = await readJsonBody(event.request, MAX_SUPER_AGENT_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return json({ error: 'Invalid tutor chat request' }, { status: 400 });
		}

		const superRequest = superAgentRequestSchema.safeParse(body);
		if (superRequest.success && superRequest.data.context.mode === 'question') {
			const access = await authorizeFeatureRequest(event, userId, 'personalizedTutor');
			if (!access.allowed) return json({ error: access.message }, { status: access.status });
			if (
				superRequest.data.context.questionType !== 'frq' ||
				!superRequest.data.context.questionId
			) {
				return json(
					{ error: 'A current FRQ question is required for Super Tutor.' },
					{ status: 400 }
				);
			}
			try {
				return await createSuperAgentStreamResponse({
					event,
					userId,
					sessionId: superRequest.data.sessionId,
					context: toSuperAgentContext(superRequest.data.context),
					messages: superRequest.data.messages,
					surface: 'question',
					errorLabel: 'Super FRQ Tutor'
				});
			} catch (error) {
				logger.error('Super FRQ Tutor chat error', { error });
				return json({ error: 'Failed to start Super FRQ Tutor' }, { status: 500 });
			}
		}

		const result = frqTutorChatRequestSchema.safeParse(body);
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

		const question = await getFrqQuestionById(result.data.questionId);
		if (!getFrqCourseProfile(question.apClass)) {
			return json(
				{ error: 'Written-response practice is unavailable for this course' },
				{ status: 404 }
			);
		}

		let attempt = null;
		if (result.data.attemptId) {
			attempt = await getFrqAttemptForUser(userId, result.data.attemptId);
			if (!attempt || attempt.questionId !== result.data.questionId) {
				return json({ error: 'Written-response attempt not found' }, { status: 404 });
			}
		}

		const rate = await limitGenericTutor(event.request, userId);
		if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);

		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'frq_tutor_chat_started',
			properties: {
				ap_class: question.apClass,
				unit: question.unit,
				has_submission: Boolean(attempt),
				has_prior_conversation: result.data.conversationHistory.length > 0,
				personalized: false
			}
		});

		const stream = createFrqTutorChatStream(
			{ question, attempt },
			result.data,
			event.request.signal,
			{ chatImpl: chatFrq, timeoutMs: TUTOR_CHAT_STREAM_TIMEOUT_MS }
		);
		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	},
	{ logLabel: 'FRQ tutor chat error', errorMessage: 'Failed to start FRQ tutor chat' }
);
