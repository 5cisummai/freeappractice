import { consumeStream, createAgentUIStreamResponse } from 'ai';
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
	isSuperAgentToolContinuation,
	lastSuperAgentUserText,
	textFromSuperAgentParts,
	type SuperAgentRequest
} from '$lib/super/agent-request';
import { buildSuperAgentUiMessages } from '$lib/super/agent-history.server';
import {
	appendConversationMessage,
	ensureConversation,
	generateConversationTitle,
	ConversationAccessError,
	finalizeConversationMessage,
	getConversationMessages,
	linkCoachAuditsToAssistantMessage,
	markConversationMessageStreaming
} from '$lib/super/conversations.server';
import { coachComposerActionInstructions } from '$lib/super/coach-composer-actions';

const SUPER_AGENT_STREAM_TIMEOUT_MS = 55_000;

export type SuperAgentStreamOptions = {
	event: RequestEvent;
	userId: string;
	sessionId: string;
	context: SuperAgentContext;
	messages: SuperAgentRequest['messages'];
	conversationId?: string;
	coachActions?: SuperAgentRequest['coachActions'];
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
		coachActions,
		surface,
		errorLabel
	} = options;
	const clientMessages = messages;
	const isContinuation = isSuperAgentToolContinuation(clientMessages);
	type PersonalizedTurnHandle =
		| Awaited<ReturnType<typeof startPersonalizedTurn>>
		| { kind: 'continuation' };
	let personalizedTurn: PersonalizedTurnHandle;
	if (isContinuation) {
		personalizedTurn = { kind: 'continuation' };
	} else {
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
	}

	let lock: Awaited<ReturnType<typeof acquireCoachLock>>;
	try {
		lock = await acquireCoachLock(userId);
	} catch (error) {
		if (personalizedTurn.kind === 'reserved') {
			await personalizedTurn.releaseIfUnused().catch(() => undefined);
		}
		if (error instanceof RedisRequiredError) {
			return json(
				{ error: 'Personalized tutoring is temporarily unavailable. Please try again.' },
				{ status: 503 }
			);
		}
		throw error;
	}
	if (!lock) {
		if (personalizedTurn.kind === 'reserved') {
			await personalizedTurn.releaseIfUnused().catch(() => undefined);
		}
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
			if (!emittedOutput && personalizedTurn.kind === 'reserved') {
				await personalizedTurn.releaseIfUnused().catch(() => undefined);
			}
			await releaseLock(lock);
		};

		const incomingUserText = lastSuperAgentUserText(clientMessages);
		if (!incomingUserText && !isContinuation) {
			await cleanup();
			return json({ error: 'The Super Agent needs a student message.' }, { status: 400 });
		}

		const profile = await getTutorProfileViewForRequest(event.locals, userId);
		conversationId = await ensureConversation(userId, {
			conversationId: requestedConversationId,
			surface,
			context,
			...(!requestedConversationId && !isContinuation
				? { title: await generateConversationTitle(incomingUserText, surface) }
				: {})
		});

		if (!isContinuation) {
			const incomingUser = [...clientMessages].reverse().find((message) => message.role === 'user');
			await appendConversationMessage(userId, {
				conversationId,
				role: 'user',
				content: incomingUserText,
				parts: incomingUser?.parts ?? [{ type: 'text', text: incomingUserText }],
				clientMessageId: incomingUser?.id,
				status: 'complete'
			});
		}

		if (isContinuation) {
			const storedMessages = await getConversationMessages(
				userId,
				conversationId,
				MAX_SUPER_AGENT_MESSAGES
			);
			const lastAssistant = [...storedMessages]
				.reverse()
				.find((message) => message.role === 'assistant');
			if (!lastAssistant) {
				await cleanup();
				return json({ error: 'Coach could not continue that practice question.' }, { status: 409 });
			}
			assistantMessageId = lastAssistant.id;
			await markConversationMessageStreaming(userId, assistantMessageId);
		} else {
			assistantMessageId = await appendConversationMessage(userId, {
				conversationId,
				role: 'assistant',
				status: 'streaming'
			});
		}

		const { messages: uiMessages, historySummary } = await buildSuperAgentUiMessages({
			userId,
			conversationId,
			clientMessages,
			isContinuation,
			streamingAssistantMessageId: assistantMessageId
		});
		const lastUserMessage = lastSuperAgentUserText(
			uiMessages
				.filter((message) => message.role === 'user' || message.role === 'assistant')
				.map((message) => ({
					role: message.role as 'user' | 'assistant',
					parts: message.parts as SuperAgentRequest['messages'][number]['parts']
				}))
		);

		const personalization = await buildSuperAgentContext(userId, lastUserMessage, context);
		const memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
		const agent = createSuperAgent({
			locals: event.locals,
			userId,
			sessionId,
			selectedApClasses: profile.selectedApClasses,
			personalizationContext: personalization.text,
			historySummary,
			mode: context.mode,
			currentContext: context,
			conversationId,
			composerActionInstructions: coachComposerActionInstructions(coachActions ?? [])
		});

		const markUsageIfNeeded = async (responseMessage: SuperAgentUIMessage) => {
			if (emittedOutput || personalizedTurn.kind !== 'reserved') return;
			const hasBillableOutput = responseMessage.parts.some((part) => {
				if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
					return part.text.trim().length > 0;
				}
				return typeof part.type === 'string' && part.type.startsWith('tool-');
			});
			if (!hasBillableOutput) return;
			emittedOutput = true;
			await personalizedTurn
				.markOutput()
				.catch((error) => logger.warn('Failed to roll up Super Agent usage', { error }));
		};

		return createAgentUIStreamResponse({
			agent,
			uiMessages,
			abortSignal: AbortSignal.any([event.request.signal, streamTimeout.signal]),
			consumeSseStream: consumeStream,
			originalMessages: uiMessages,
			onStepFinish: (step) => {
				logger.info('Super Agent step finish', {
					surface,
					conversationId,
					stepNumber: step.stepNumber,
					inputTokens: step.usage.inputTokens,
					outputTokens: step.usage.outputTokens,
					totalTokens: step.usage.totalTokens,
					uiMessageCount: uiMessages.length,
					modelId: step.model.modelId
				});
			},
			onFinish: async ({ responseMessage, isAborted }) => {
				try {
					await markUsageIfNeeded(responseMessage);
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
					if (
						!isAborted &&
						!isContinuation &&
						memoryConsentGiven &&
						(await isTutorMemoryAvailable())
					) {
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
			},
			headers: {
				'Cache-Control': 'no-cache',
				'X-Super-Conversation-Id': conversationId,
				'X-Tutor-Personalization-Degraded': personalization.memoryDegraded ? '1' : '0',
				'X-Super-Usage-Remaining':
					personalizedTurn.kind === 'reserved'
						? String(personalizedTurn.reservation.remaining)
						: '0',
				...(personalizedTurn.kind === 'reserved' && personalizedTurn.usageWarning
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
		else if (personalizedTurn.kind === 'reserved') {
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
