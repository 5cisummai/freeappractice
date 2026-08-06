import { json } from '@sveltejs/kit';
import { consumeStream, createUIMessageStreamResponse } from 'ai';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { isSuperCoachEnabled } from '$lib/flags';
import { addTutorMemoryExchange, isTutorMemoryAvailable } from '$lib/mem0/service.server';
import { logger } from '$lib/server/logger';
import {
	acquireCoachLock,
	getSuperMonthlyMessageLimit,
	getPersonalizedUsageWarning,
	limitSuperAi,
	RedisRequiredError,
	releaseLock,
	releasePersonalizedTurn,
	refreshLock,
	reservePersonalizedTurn,
	rollupPersonalizedUsage
} from '$lib/super/ai-controls.server';
import { createCoachAgent, type CoachUIMessage } from '$lib/super/coach.server';
import { getSuperFeatureAccess, superFeatureAccessMessage } from '$lib/super/feature-access.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import { buildTutorPersonalization } from '$lib/tutor/personalization.server';
import { scheduleTutorMemoryWrite } from '$lib/tutor/response-utils.server';

const MAX_COACH_MESSAGES = 12;
const MAX_COACH_REQUEST_BYTES = 32 * 1024;
const COACH_STREAM_TIMEOUT_MS = 55_000;
const coachMessagePartSchema = z
	.object({ type: z.string().min(1).max(100), text: z.string().max(2_000).optional() })
	.passthrough();
const coachRequestSchema = z
	.object({
		sessionId: z.string().uuid(),
		messages: z
			.array(
				z
					.object({
						role: z.enum(['user', 'assistant']),
						parts: z.array(coachMessagePartSchema).max(24)
					})
					.passthrough()
			)
			.min(1)
			.max(MAX_COACH_MESSAGES * 2)
	})
	.strict();

class RequestTooLargeError extends Error {}

/** Keep cleanup time inside Vercel's route duration even if a provider stream stalls. */
export const config = { maxDuration: 60 };

function coachRateLimitedResponse(retryAt: number | null): Response {
	return json(
		{ error: 'Too many Coach requests. Please try again shortly.', retryAt },
		retryAt
			? {
					status: 429,
					headers: {
						'Retry-After': String(Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)))
					}
				}
			: { status: 429 }
	);
}

async function readCoachRequest(request: Request): Promise<unknown> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_COACH_REQUEST_BYTES) {
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
		if (receivedBytes > MAX_COACH_REQUEST_BYTES) {
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

function toCoachModelMessages(messages: z.infer<typeof coachRequestSchema>['messages']) {
	return messages.slice(-MAX_COACH_MESSAGES).flatMap((message) => {
		const content = message.parts
			.filter((part) => part.type === 'text' && typeof part.text === 'string')
			.map((part) => part.text!.trim())
			.filter(Boolean)
			.join('\n')
			.slice(0, 2_000);
		return content ? [{ role: message.role, content } as const] : [];
	});
}

function textFromCoachParts(parts: Array<{ type?: string; text?: string }> | undefined): string {
	return (parts ?? [])
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => part.text!.trim())
		.filter(Boolean)
		.join('\n')
		.slice(0, 2_000);
}

export const POST: RequestHandler = withAuthedHandler(
	async (event, userId) => {
		if (!(await isSuperCoachEnabled())) {
			return json({ error: 'Coach is temporarily unavailable.' }, { status: 503 });
		}
		const access = await getSuperFeatureAccess(userId, 'coach');
		if (!access.allowed)
			return json({ error: superFeatureAccessMessage(access, 'Coach') }, { status: 403 });

		let body: unknown;
		try {
			body = await readCoachRequest(event.request);
		} catch (error) {
			return json(
				{
					error:
						error instanceof RequestTooLargeError
							? 'Coach request is too large'
							: 'Invalid Coach request'
				},
				{ status: error instanceof RequestTooLargeError ? 413 : 400 }
			);
		}
		const parsed = coachRequestSchema.safeParse(body);
		if (!parsed.success) return json({ error: 'Invalid Coach request' }, { status: 400 });
		const messages = toCoachModelMessages(parsed.data.messages);
		if (!messages.length || messages.at(-1)?.role !== 'user') {
			return json({ error: 'Coach needs a student message.' }, { status: 400 });
		}

		try {
			const rate = await limitSuperAi(userId);
			if (!rate.allowed) return coachRateLimitedResponse(rate.retryAt);
			const reservation = await reservePersonalizedTurn(userId);
			if (!reservation) {
				return json(
					{
						error: `Your ${await getSuperMonthlyMessageLimit()} personalized messages for this month have been used.`
					},
					{ status: 429 }
				);
			}
			const lock = await acquireCoachLock(userId);
			if (!lock) {
				await releasePersonalizedTurn(userId, reservation.month).catch(() => undefined);
				return json({ error: 'Another Coach request is still running.' }, { status: 409 });
			}

			let cleanup: (() => Promise<void>) | undefined;
			try {
				let emittedOutput = false;
				let cleanedUp = false;
				const streamTimeout = new AbortController();
				const streamTimeoutId = setTimeout(() => streamTimeout.abort(), COACH_STREAM_TIMEOUT_MS);
				const refreshTimer = setInterval(() => {
					void refreshLock(lock).catch(() => undefined);
				}, 30_000);
				cleanup = async () => {
					if (cleanedUp) return;
					cleanedUp = true;
					clearTimeout(streamTimeoutId);
					clearInterval(refreshTimer);
					if (!emittedOutput) {
						await releasePersonalizedTurn(userId, reservation.month).catch((error) =>
							logger.warn('Failed to release unused Coach reservation', { error })
						);
					}
					await releaseLock(lock);
				};
				const profile = await getTutorProfileView(userId);
				const lastUserMessage = messages.at(-1)?.content ?? '';
				const personalization = await buildTutorPersonalization(userId, lastUserMessage);
				const memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
				const agent = createCoachAgent({
					userId,
					sessionId: parsed.data.sessionId,
					selectedApClasses: profile.selectedApClasses,
					personalizationContext: personalization.context
				});
				const result = await agent.stream({
					messages,
					abortSignal: AbortSignal.any([event.request.signal, streamTimeout.signal])
				});
				const uiStream = result
					.toUIMessageStream<CoachUIMessage>({
						originalMessages: parsed.data.messages as unknown as CoachUIMessage[],
						onFinish: async ({ responseMessage, isAborted }) => {
							try {
								if (!isAborted && memoryConsentGiven && (await isTutorMemoryAvailable())) {
									const assistantResponse = textFromCoachParts(
										responseMessage.parts as Array<{ type?: string; text?: string }>
									);
									if (lastUserMessage.trim() && assistantResponse.trim()) {
										scheduleTutorMemoryWrite(
											addTutorMemoryExchange(
												userId,
												{ user: lastUserMessage, assistant: assistantResponse },
												{ surface: 'coach' }
											),
											'Coach'
										);
									}
								}
							} finally {
								await cleanup?.();
							}
						},
						onError: (error) => {
							logger.error('Coach stream error', { error });
							return 'The Coach could not complete that request. Please try again.';
						}
					})
					.pipeThrough(
						new TransformStream({
							transform(chunk, controller) {
								if (chunk.type === 'text-delta' && chunk.delta.trim() && !emittedOutput) {
									emittedOutput = true;
									void rollupPersonalizedUsage(userId, reservation).catch((error) =>
										logger.warn('Failed to roll up Coach usage', { error })
									);
								}
								controller.enqueue(chunk);
							}
						})
					);
				return createUIMessageStreamResponse({
					stream: uiStream,
					consumeSseStream: consumeStream,
					headers: {
						'Cache-Control': 'no-cache',
						'X-Tutor-Personalization-Degraded': personalization.memoryDegraded ? '1' : '0',
						'X-Super-Usage-Remaining': String(reservation.remaining),
						...(getPersonalizedUsageWarning(reservation)
							? { 'X-Super-Usage-Warning': String(getPersonalizedUsageWarning(reservation)) }
							: {})
					}
				});
			} catch (error) {
				if (cleanup) await cleanup();
				else {
					await releasePersonalizedTurn(userId, reservation.month).catch(() => undefined);
					await releaseLock(lock);
				}
				throw error;
			}
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return json(
					{ error: 'Coach is temporarily unavailable. Please try again.' },
					{ status: 503 }
				);
			}
			throw error;
		}
	},
	{ logLabel: 'Coach request error', errorMessage: 'Failed to start Coach' }
);
