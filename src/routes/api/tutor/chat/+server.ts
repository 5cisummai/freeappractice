import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/auth/server';
import { getQuestionById } from '$lib/questions/storage.server';
import { addTutorMemoryExchange, isTutorMemoryAvailable } from '$lib/mem0/service.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { logger } from '$lib/server/logger';
import { limitGenericTutor, RedisRequiredError } from '$lib/super/ai-controls.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import {
	startPersonalizedTurn,
	type ReservedPersonalizedTurn
} from '$lib/super/personalized-turn.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { createTutorChatStream } from '$lib/tutor/chat-stream.server';
import { MAX_TUTOR_CHAT_REQUEST_BYTES, tutorChatRequestSchema } from '$lib/tutor/chat-request';
import { buildTutorPersonalization } from '$lib/tutor/personalization.server';
import {
	scheduleTutorMemoryWrite,
	tutorRateLimitedResponse
} from '$lib/tutor/response-utils.server';
import { chat } from '$lib/tutor/service.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-stream.server';
import {
	MAX_SUPER_AGENT_REQUEST_BYTES,
	superAgentRequestSchema,
	toSuperAgentContext
} from '$lib/super/agent-request';

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
		let body: unknown;
		try {
			body = await readJsonBody(
				request,
				Math.max(MAX_TUTOR_CHAT_REQUEST_BYTES, MAX_SUPER_AGENT_REQUEST_BYTES)
			);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return json({ error: 'Tutor chat request must be valid JSON' }, { status: 400 });
		}

		const superRequest = superAgentRequestSchema.safeParse(body);
		if (superRequest.success && superRequest.data.context.mode === 'question') {
			const userId = await getOptionalUserId(event);
			if (!userId) return json({ error: 'Authentication required' }, { status: 401 });
			const entitlements = await getEntitlements(userId);
			if (!entitlements.personalizedTutor) {
				return json({ error: 'Super subscription required' }, { status: 403 });
			}
			if (
				superRequest.data.context.questionType !== 'mcq' ||
				!superRequest.data.context.questionId
			) {
				return json({ error: 'A current question is required for Super Tutor.' }, { status: 400 });
			}
			const profile = await getTutorProfileViewForRequest(event.locals, userId);
			if (!profile.ageConfirmedAt) {
				return json(
					{ error: 'Confirm that you are at least 13 to use Super tutoring.' },
					{ status: 403 }
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
					errorLabel: 'Super Tutor'
				});
			} catch (error) {
				logger.error('Super Tutor chat error', { error });
				return json({ error: 'Failed to start Super Tutor' }, { status: 500 });
			}
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

		const question = await getQuestionById(result.data.questionId).catch(() => null);
		if (!question) return json({ error: 'Question not found' }, { status: 404 });

		const userId = await getOptionalUserId(event);
		const entitlements = userId ? await getEntitlements(userId) : null;
		let isPersonalized = Boolean(userId && entitlements?.personalizedTutor);
		let personalizationContext: string | undefined;
		let memoryDegraded = false;
		let memoryConsentGiven = false;
		let personalizedTurn: ReservedPersonalizedTurn | null = null;

		if (isPersonalized && userId) {
			const profile = await getTutorProfileViewForRequest(event.locals, userId);
			if (!profile.ageConfirmedAt) {
				return json(
					{ error: 'Confirm that you are at least 13 to use Super tutoring.' },
					{ status: 403 }
				);
			}
			try {
				const turn = await startPersonalizedTurn(userId);
				if (turn.kind === 'rate-limited') return tutorRateLimitedResponse(turn.retryAt);
				if (turn.kind === 'exhausted') {
					// The student keeps the existing Free tutor after their personalized allowance resets.
					isPersonalized = false;
				} else {
					personalizedTurn = turn;
				}
			} catch (error) {
				if (error instanceof RedisRequiredError) {
					return json(
						{ error: 'Personalized tutoring is temporarily unavailable. Please try again.' },
						{ status: 503 }
					);
				}
				throw error;
			}

			if (personalizedTurn)
				try {
					const personalization = await buildTutorPersonalization(userId, result.data.message);
					personalizationContext = personalization.context;
					memoryDegraded = personalization.memoryDegraded;
					memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
				} catch (error) {
					await personalizedTurn
						.releaseIfUnused()
						.catch((releaseError) =>
							logger.warn('Failed to release unused tutor reservation', { error: releaseError })
						);
					throw error;
				}
		}
		if (!isPersonalized) {
			const rate = await limitGenericTutor(request, userId);
			if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);
		}

		capturePostHogServerEvent(request, {
			distinctId: userId ?? 'anonymous',
			event: 'tutor_chat_started',
			properties: {
				ap_class: question.apClass,
				unit: question.unit,
				has_prior_conversation: result.data.conversationHistory.length > 0,
				personalized: isPersonalized
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
				},
				...(personalizationContext ? { personalizationContext } : {})
			},
			result.data,
			request.signal,
			{
				chatImpl: chat,
				callbacks:
					personalizedTurn && userId
						? {
								onFirstChunk: () => personalizedTurn!.markOutput(),
								onFailureBeforeOutput: () => personalizedTurn!.releaseIfUnused(),
								onComplete: async (assistantResponse) => {
									if (!assistantResponse.trim()) return undefined;
									if (!memoryConsentGiven || !(await isTutorMemoryAvailable())) return undefined;
									scheduleTutorMemoryWrite(
										addTutorMemoryExchange(userId, {
											user: result.data.message,
											assistant: assistantResponse
										}),
										'MCQ'
									);
									return { memoryUpdated: true };
								}
							}
						: undefined
			}
		);

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'X-Tutor-Personalization-Degraded': memoryDegraded ? '1' : '0',
				...(personalizedTurn
					? {
							'X-Super-Usage-Remaining': String(personalizedTurn.reservation.remaining),
							...(personalizedTurn.usageWarning
								? { 'X-Super-Usage-Warning': String(personalizedTurn.usageWarning) }
								: {})
						}
					: {})
			}
		});
	} catch (error) {
		logger.error('Tutor chat error', { error });
		return json({ error: 'Failed to start tutor chat' }, { status: 500 });
	}
};
