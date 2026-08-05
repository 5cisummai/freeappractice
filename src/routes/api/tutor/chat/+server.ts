import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '$lib/auth/server';
import { getQuestionFromS3 } from '$lib/questions/storage.server';
import { addTutorMemoryExchange, isTutorMemoryAvailable } from '$lib/mem0/service.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { logger } from '$lib/server/logger';
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
import { createTutorChatStream } from '$lib/tutor/chat-stream.server';
import { MAX_TUTOR_CHAT_REQUEST_BYTES, tutorChatRequestSchema } from '$lib/tutor/chat-request';
import { buildTutorPersonalization } from '$lib/tutor/personalization.server';
import {
	scheduleTutorMemoryWrite,
	tutorRateLimitedResponse
} from '$lib/tutor/response-utils.server';
import { chat } from '$lib/tutor/service.server';

class RequestTooLargeError extends Error {}

async function readRequestBody(request: Request): Promise<unknown> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_TUTOR_CHAT_REQUEST_BYTES) {
		throw new RequestTooLargeError();
	}

	if (!request.body) return null;

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let receivedBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		receivedBytes += value.byteLength;
		if (receivedBytes > MAX_TUTOR_CHAT_REQUEST_BYTES) {
			await reader.cancel();
			throw new RequestTooLargeError();
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(receivedBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return JSON.parse(new TextDecoder().decode(bytes));
}

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
			body = await readRequestBody(request);
		} catch (error) {
			if (error instanceof RequestTooLargeError) {
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

		const question = await getQuestionFromS3(result.data.questionId).catch(() => null);
		if (!question) return json({ error: 'Question not found' }, { status: 404 });

		const userId = await getOptionalUserId(event);
		const entitlements = userId ? await getEntitlements(userId) : null;
		let isPersonalized = Boolean(userId && entitlements?.personalizedTutor);
		let personalizationContext: string | undefined;
		let memoryDegraded = false;
		let memoryConsentGiven = false;
		let reservation: Awaited<ReturnType<typeof reservePersonalizedTurn>> = null;

		if (isPersonalized && userId) {
			const profile = await getTutorProfileView(userId);
			if (!profile.ageConfirmedAt) {
				return json(
					{ error: 'Confirm that you are at least 13 to use Super tutoring.' },
					{ status: 403 }
				);
			}
			try {
				const rate = await limitSuperAi(userId, 'tutor');
				if (!rate.allowed) return tutorRateLimitedResponse(rate.retryAt);
				reservation = await reservePersonalizedTurn(userId);
				if (!reservation) {
					// The student keeps the existing Free tutor after their personalized allowance resets.
					isPersonalized = false;
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

			if (reservation)
				try {
					const personalization = await buildTutorPersonalization(userId, result.data.message);
					personalizationContext = personalization.context;
					memoryDegraded = personalization.memoryDegraded;
					memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
				} catch (error) {
					await releasePersonalizedTurn(userId, reservation.month).catch((releaseError) =>
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
					reservation && userId
						? {
								onFirstChunk: () => rollupPersonalizedUsage(userId, reservation!),
								onFailureBeforeOutput: () => releasePersonalizedTurn(userId, reservation!.month),
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
	} catch (error) {
		logger.error('Tutor chat error', { error });
		return json({ error: 'Failed to start tutor chat' }, { status: 500 });
	}
};
