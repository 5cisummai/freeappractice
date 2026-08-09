import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { requireFrqPracticeEnabled } from '$lib/frq/gate.server';
import { getFrqAttemptForUser } from '$lib/frq/attempts.server';
import { getFrqCourseProfile } from '$lib/frq/profiles.server';
import { getFrqQuestionById } from '$lib/frq/question.server';
import { chatFrq } from '$lib/tutor/service.server';
import { createFrqTutorChatStream } from '$lib/tutor/chat-stream.server';
import { frqTutorChatRequestSchema, TUTOR_CHAT_STREAM_TIMEOUT_MS } from '$lib/tutor/chat-request';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { logger } from '$lib/server/logger';
import { addTutorMemoryExchange, isTutorMemoryAvailable } from '$lib/mem0/service.server';
import {
	limitGenericTutor,
	getPersonalizedUsageWarning,
	limitSuperAi,
	RedisRequiredError,
	releasePersonalizedTurn,
	reservePersonalizedTurn,
	rollupPersonalizedUsage
} from '$lib/super/ai-controls.server';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import { buildTutorPersonalization } from '$lib/tutor/personalization.server';
import {
	scheduleTutorMemoryWrite,
	tutorRateLimitedResponse
} from '$lib/tutor/response-utils.server';

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		const gated = await requireFrqPracticeEnabled();
		if (gated) return gated;

		let body: unknown;
		try {
			body = await event.request.json();
		} catch {
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
		let reservation: Awaited<ReturnType<typeof reservePersonalizedTurn>> = null;

		if (isPersonalized) {
			const profile = await getTutorProfileView(userId);
			if (!profile.ageConfirmedAt) {
				return json(
					{ error: 'Confirm that you are at least 13 to use Super tutoring.' },
					{ status: 403 }
				);
			}
			try {
				const rate = await limitSuperAi(userId);
				if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);
				reservation = await reservePersonalizedTurn(userId);
				if (!reservation) {
					// The student keeps the existing Free tutor after their personalized allowance resets.
					isPersonalized = false;
				}
				if (reservation) {
					const personalization = await buildTutorPersonalization(userId, result.data.message);
					personalizationContext = personalization.context;
					memoryDegraded = personalization.memoryDegraded;
					memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
				}
			} catch (error) {
				if (reservation) {
					await releasePersonalizedTurn(userId, reservation.month).catch((releaseError) =>
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
				callbacks: reservation
					? {
							onFirstChunk: () => rollupPersonalizedUsage(userId, reservation!),
							onFailureBeforeOutput: () => releasePersonalizedTurn(userId, reservation!.month),
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
				...(reservation
					? {
							'X-Super-Usage-Remaining': String(reservation.remaining),
							...(getPersonalizedUsageWarning(reservation)
								? { 'X-Super-Usage-Warning': String(getPersonalizedUsageWarning(reservation)) }
								: {})
						}
					: {})
			}
		});
	},
	{ logLabel: 'FRQ tutor chat error', errorMessage: 'Failed to start FRQ tutor chat' }
);
