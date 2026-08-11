import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { requireFrqPracticeEnabled } from '$lib/frq/gate.server';
import { getFrqAttemptForUser } from '$lib/frq/attempts.server';
import { getFrqCourseProfile } from '$lib/frq/profiles.server';
import { getFrqQuestionById } from '$lib/frq/question.server';
import { chatFrq } from '$lib/tutor/service.server';
import { createFrqTutorChatStream } from '$lib/tutor/chat-stream.server';
import {
	frqTutorChatRequestSchema,
	MAX_TUTOR_CHAT_REQUEST_BYTES,
	TUTOR_CHAT_STREAM_TIMEOUT_MS
} from '$lib/tutor/chat-request';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { logger } from '$lib/server/logger';
import { addTutorMemoryExchange, isTutorMemoryAvailable } from '$lib/mem0/service.server';
import { limitGenericTutor, RedisRequiredError } from '$lib/super/ai-controls.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileViewForRequest } from '$lib/super/profile-cache.server';
import {
	startPersonalizedTurn,
	type ReservedPersonalizedTurn
} from '$lib/super/personalized-turn.server';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';
import { buildTutorPersonalization } from '$lib/tutor/personalization.server';
import {
	scheduleTutorMemoryWrite,
	tutorRateLimitedResponse
} from '$lib/tutor/response-utils.server';
import { createSuperAgentStreamResponse } from '$lib/super/agent-stream.server';
import {
	MAX_SUPER_AGENT_REQUEST_BYTES,
	superAgentRequestSchema,
	toSuperAgentContext
} from '$lib/super/agent-request';

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;

		let body: unknown;
		try {
			body = await readJsonBody(
				event.request,
				Math.max(MAX_TUTOR_CHAT_REQUEST_BYTES, MAX_SUPER_AGENT_REQUEST_BYTES)
			);
		} catch (error) {
			if (error instanceof RequestBodyTooLargeError) {
				return json({ error: 'Tutor chat request is too large' }, { status: 413 });
			}
			return json({ error: 'Invalid tutor chat request' }, { status: 400 });
		}

		const superRequest = superAgentRequestSchema.safeParse(body);
		if (superRequest.success && superRequest.data.context.mode === 'question') {
			if (
				superRequest.data.context.questionType !== 'frq' ||
				!superRequest.data.context.questionId
			) {
				return json(
					{ error: 'A current FRQ question is required for Super Tutor.' },
					{ status: 400 }
				);
			}
			const entitlements = await getEntitlements(userId);
			if (!entitlements.personalizedTutor) {
				return json({ error: 'Super subscription required' }, { status: 403 });
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
					errorLabel: 'Super FRQ Tutor'
				});
			} catch (error) {
				logger.error('Super FRQ Tutor chat error', { error });
				return json({ error: 'Failed to start Super FRQ Tutor' }, { status: 500 });
			}
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

		const entitlements = await getEntitlements(userId);
		let isPersonalized = entitlements.personalizedTutor;
		let personalizationContext: string | undefined;
		let memoryDegraded = false;
		let memoryConsentGiven = false;
		let personalizedTurn: ReservedPersonalizedTurn | null = null;

		if (isPersonalized) {
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
					const personalization = await buildTutorPersonalization(userId, result.data.message);
					personalizationContext = personalization.context;
					memoryDegraded = personalization.memoryDegraded;
					memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
				}
			} catch (error) {
				if (personalizedTurn) {
					await personalizedTurn
						.releaseIfUnused()
						.catch((releaseError) =>
							logger.warn('Failed to release unused FRQ tutor reservation', { error: releaseError })
						);
				}
				if (error instanceof RedisRequiredError) {
					return json(
						{ error: 'Personalized tutoring is temporarily unavailable. Please try again.' },
						{ status: 503 }
					);
				}
				throw error;
			}
		}
		if (!isPersonalized) {
			const rate = await limitGenericTutor(event.request, userId);
			if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);
		}

		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'frq_tutor_chat_started',
			properties: {
				ap_class: question.apClass,
				unit: question.unit,
				has_submission: Boolean(attempt),
				has_prior_conversation: result.data.conversationHistory.length > 0,
				personalized: isPersonalized
			}
		});

		const stream = createFrqTutorChatStream(
			{ question, attempt, ...(personalizationContext ? { personalizationContext } : {}) },
			result.data,
			event.request.signal,
			{
				chatImpl: chatFrq,
				timeoutMs: TUTOR_CHAT_STREAM_TIMEOUT_MS,
				callbacks: personalizedTurn
					? {
							onFirstChunk: () => personalizedTurn!.markOutput(),
							onFailureBeforeOutput: () => personalizedTurn!.releaseIfUnused(),
							onComplete: async (assistantResponse) => {
								if (
									!assistantResponse.trim() ||
									!memoryConsentGiven ||
									!(await isTutorMemoryAvailable())
								)
									return undefined;
								scheduleTutorMemoryWrite(
									addTutorMemoryExchange(userId, {
										user: result.data.message,
										assistant: assistantResponse
									}),
									'FRQ'
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
	},
	{ logLabel: 'FRQ tutor chat error', errorMessage: 'Failed to start FRQ tutor chat' }
);
