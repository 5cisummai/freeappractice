import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { requireFrqPracticeEnabled } from '$lib/question-bank/frq/gate.server';
import { getFrqAttemptForUser } from '$lib/grading/frq/attempts.server';
import { getFrqCourseProfile } from '$lib/question-bank/frq/profiles.server';
import { getFrqQuestionById } from '$lib/question-bank/frq/model.server';
import { chatFrq } from '$lib/tutor/service.server';
import { createFrqTutorChatStream } from '$lib/tutor/chat-stream.server';
import {
	frqTutorChatRequestSchema,
	MAX_TUTOR_CHAT_REQUEST_BYTES,
	TUTOR_CHAT_STREAM_TIMEOUT_MS
} from '$lib/tutor/chat-request';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { limitGenericTutor } from '$lib/super/ai-controls.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { tutorRateLimitedResponse } from '$lib/tutor/response-utils.server';
import { getAssistantFeaturesEnabledForRequest } from '$lib/super/assistant.server';

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;
		if (!(await getAssistantFeaturesEnabledForRequest(event.locals, userId))) {
			return json({ error: 'Assistant features are disabled for this account.' }, { status: 403 });
		}

		let body: unknown;
		try {
			body = await readJsonBody(event.request, MAX_TUTOR_CHAT_REQUEST_BYTES);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return json({ error: 'Invalid tutor chat request' }, { status: 400 });
		}

		const result = frqTutorChatRequestSchema.safeParse(body);
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
		if (!getFrqCourseProfile(question.course)) {
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
				course: question.course,
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
