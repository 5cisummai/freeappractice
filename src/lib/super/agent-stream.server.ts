import { consumeStream, createUIMessageStreamResponse } from 'ai';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { addTutorMemoryExchange, isTutorMemoryAvailable } from '$lib/mem0/service.server';
import { logger } from '$lib/server/logger';
import {
	acquireCoachLock,
	getSuperMonthlyMessageLimit,
	RedisRequiredError,
	releaseLock,
	refreshLock
} from '$lib/super/ai-controls.server';
import {
	createSuperAgent,
	type SuperAgentContext,
	type SuperAgentUIMessage
} from '$lib/super/coach.server';
import { buildSuperAgentContext } from '$lib/super/context.server';
import { getTutorProfileViewForRequest } from '$lib/super/feature-access.server';
import { startPersonalizedTurn } from '$lib/super/personalized-turn.server';
import { scheduleTutorMemoryWrite } from '$lib/tutor/response-utils.server';
import {
	MAX_SUPER_AGENT_MESSAGES,
	textFromSuperAgentParts,
	toSuperAgentModelMessages
} from '$lib/super/agent-request';
import {
	appendConversationMessage,
	ensureConversation,
	generateConversationTitle,
	ConversationAccessError,
	finalizeConversationMessage,
	getConversationMessages,
	linkCoachAuditsToAssistantMessage
} from '$lib/super/conversations.server';

const SUPER_AGENT_STREAM_TIMEOUT_MS = 55_000;

export type SuperAgentStreamOptions = {
	event: RequestEvent;
	userId: string;
	sessionId: string;
	context: SuperAgentContext;
	messages: Parameters<typeof toSuperAgentModelMessages>[0];
	conversationId?: string;
	surface: 'coach' | 'question';
	errorLabel: string;
};

function rateLimitedResponse(retryAt: number | null): Response {
	return json(
		{ error: 'Too many personalized AI requests. Please try again shortly.', retryAt },
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

export async function createSuperAgentStreamResponse(
	options: SuperAgentStreamOptions
): Promise<Response> {
	const {
		event,
		userId,
		sessionId,
		context,
		messages,
		conversationId: requestedConversationId,
		surface,
		errorLabel
	} = options;
	let personalizedTurn: Awaited<ReturnType<typeof startPersonalizedTurn>>;
	try {
		personalizedTurn = await startPersonalizedTurn(userId);
	} catch (error) {
		if (error instanceof RedisRequiredError) {
			return json(
				{ error: 'Personalized tutoring is temporarily unavailable. Please try again.' },
				{ status: 503 }
			);
		}
		throw error;
	}
	if (personalizedTurn.kind === 'rate-limited')
		return rateLimitedResponse(personalizedTurn.retryAt);
	if (personalizedTurn.kind === 'exhausted') {
		return json(
			{
				error: `Your ${await getSuperMonthlyMessageLimit()} personalized messages for this month have been used.`
			},
			{ status: 429 }
		);
	}

	let lock: Awaited<ReturnType<typeof acquireCoachLock>>;
	try {
		lock = await acquireCoachLock(userId);
	} catch (error) {
		await personalizedTurn.releaseIfUnused().catch(() => undefined);
		if (error instanceof RedisRequiredError) {
			return json(
				{ error: 'Personalized tutoring is temporarily unavailable. Please try again.' },
				{ status: 503 }
			);
		}
		throw error;
	}
	if (!lock) {
		await personalizedTurn.releaseIfUnused().catch(() => undefined);
		return json({ error: 'Another personalized AI request is still running.' }, { status: 409 });
	}

	let cleanup: (() => Promise<void>) | undefined;
	let assistantMessageId: string | undefined;
	let conversationId: string | undefined;
	try {
		let emittedOutput = false;
		let cleanedUp = false;
		const streamTimeout = new AbortController();
		const streamTimeoutId = setTimeout(() => streamTimeout.abort(), SUPER_AGENT_STREAM_TIMEOUT_MS);
		const refreshTimer = setInterval(() => {
			void refreshLock(lock).catch(() => undefined);
		}, 30_000);
		cleanup = async () => {
			if (cleanedUp) return;
			cleanedUp = true;
			clearTimeout(streamTimeoutId);
			clearInterval(refreshTimer);
			if (!emittedOutput) await personalizedTurn.releaseIfUnused().catch(() => undefined);
			await releaseLock(lock);
		};

		const profile = await getTutorProfileViewForRequest(event.locals, userId);
		const incomingModelMessages = toSuperAgentModelMessages(messages);
		const lastUserMessage =
			incomingModelMessages.at(-1)?.role === 'user'
				? (incomingModelMessages.at(-1)?.content ?? '')
				: '';
		if (!lastUserMessage) {
			await cleanup();
			return json({ error: 'The Super Agent needs a student message.' }, { status: 400 });
		}
		conversationId = await ensureConversation(userId, {
			conversationId: requestedConversationId,
			surface,
			context,
			...(!requestedConversationId
				? { title: await generateConversationTitle(lastUserMessage, surface) }
				: {})
		});
		const incomingUser = [...messages].reverse().find((message) => message.role === 'user');
		await appendConversationMessage(userId, {
			conversationId,
			role: 'user',
			content: lastUserMessage,
			parts: incomingUser?.parts ?? [{ type: 'text', text: lastUserMessage }],
			clientMessageId: incomingUser?.id,
			status: 'complete'
		});
		const serverMessages = (
			await getConversationMessages(userId, conversationId, MAX_SUPER_AGENT_MESSAGES)
		)
			.filter((message) => message.content.trim())
			.slice(-MAX_SUPER_AGENT_MESSAGES)
			.map((message) => ({ role: message.role, content: message.content }) as const);
		assistantMessageId = await appendConversationMessage(userId, {
			conversationId,
			role: 'assistant',
			status: 'streaming'
		});
		const personalization = await buildSuperAgentContext(userId, lastUserMessage, context);
		const memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
		const agent = createSuperAgent({
			locals: event.locals,
			userId,
			sessionId,
			selectedApClasses: profile.selectedApClasses,
			personalizationContext: personalization.text,
			mode: context.mode,
			currentContext: context,
			conversationId
		});
		const result = await agent.stream({
			messages: serverMessages,
			abortSignal: AbortSignal.any([event.request.signal, streamTimeout.signal])
		});
		const uiStream = result
			.toUIMessageStream<SuperAgentUIMessage>({
				originalMessages: messages as unknown as SuperAgentUIMessage[],
				onFinish: async ({ responseMessage, isAborted }) => {
					try {
						const assistantResponse = textFromSuperAgentParts(
							responseMessage.parts as Array<{ type?: string; text?: string }>
						);
						if (assistantMessageId && conversationId) {
							await finalizeConversationMessage(userId, assistantMessageId, {
								content: assistantResponse,
								parts: responseMessage.parts as unknown[],
								status: isAborted ? 'aborted' : 'complete'
							});
							if (surface === 'coach' && conversationId) {
								await linkCoachAuditsToAssistantMessage(
									userId,
									conversationId,
									assistantMessageId,
									responseMessage.parts as unknown[]
								);
							}
						}
						if (!isAborted && memoryConsentGiven && (await isTutorMemoryAvailable())) {
							if (lastUserMessage.trim() && assistantResponse.trim()) {
								scheduleTutorMemoryWrite(
									addTutorMemoryExchange(
										userId,
										{ user: lastUserMessage, assistant: assistantResponse },
										{ surface: surface === 'coach' ? 'coach' : 'tutor' }
									),
									surface === 'coach' ? 'Coach' : context.questionType === 'frq' ? 'FRQ' : 'MCQ'
								);
							}
						}
					} finally {
						await cleanup?.();
					}
				},
				onError: (error) => {
					logger.error(`${errorLabel} stream error`, { error });
					return 'The personalized AI could not complete that request. Please try again.';
				}
			})
			.pipeThrough(
				new TransformStream({
					transform(chunk, controller) {
						if (chunk.type === 'text-delta' && chunk.delta.trim() && !emittedOutput) {
							emittedOutput = true;
							void personalizedTurn
								.markOutput()
								.catch((error) => logger.warn('Failed to roll up Super Agent usage', { error }));
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
				'X-Super-Conversation-Id': conversationId!,
				'X-Tutor-Personalization-Degraded': personalization.memoryDegraded ? '1' : '0',
				'X-Super-Usage-Remaining': String(personalizedTurn.reservation.remaining),
				...(personalizedTurn.usageWarning
					? { 'X-Super-Usage-Warning': String(personalizedTurn.usageWarning) }
					: {})
			}
		});
	} catch (error) {
		if (assistantMessageId) {
			await finalizeConversationMessage(userId, assistantMessageId, {
				content: '',
				parts: [],
				status: 'error'
			}).catch((finalizeError) =>
				logger.warn('Failed to finalize Super Agent error message', { finalizeError })
			);
		}
		if (cleanup) await cleanup();
		else {
			await personalizedTurn.releaseIfUnused().catch(() => undefined);
			await releaseLock(lock);
		}
		if (error instanceof RedisRequiredError) {
			return json(
				{ error: 'Personalized tutoring is temporarily unavailable. Please try again.' },
				{ status: 503 }
			);
		}
		if (error instanceof ConversationAccessError) {
			return json({ error: error.message }, { status: error.status });
		}
		throw error;
	}
}
