import { scheduleBackgroundTask } from '#lib/server/background-task.server.js';
import { hasAnalyticsConsent } from '#lib/server/analytics-consent.js';
import {
	fallbackConversationTitle,
	updateAutomaticTitle
} from '#lib/agent/conversations/titles.server.js';
import { summarizeConversation } from '#lib/agent/conversations/summary.server.js';
/**
 * Super turn runtime: owns request lifecycle, context assembly, persistence,
 * quota/lock cleanup, and UI streaming around the pure ToolLoopAgent.
 */
import { consumeStream, createAgentUIStreamResponse, type LanguageModelUsage } from 'ai';
import type { RequestEvent } from '@sveltejs/kit';
import {
	addTutorMemoryExchange,
	isTutorMemoryAvailable
} from '#lib/agent/memory/service.server.js';
import { SIM_MODEL } from '#lib/agent/tools/simulation.server.js';
import { logger } from '#lib/server/logger.js';
import { acquireCoachLock, releaseLock, refreshLock } from '#lib/agent/usage/controls.server.js';
import type { SuperAccessReason } from '#lib/billing/types.js';
import {
	addLanguageModelUsage,
	createEmptyLanguageModelUsage,
	formatCreditsFromMilli,
	monthlyCreditLimitMilli,
	usdFromLanguageModelUsage
} from '#lib/agent/usage/credits.js';
import { createAgent, type AgentUIMessage } from '#lib/agent/agent.server.js';
import { buildAgentContext } from '#lib/agent/personalization/context.server.js';
import { getTutorProfileViewForRequest } from '#lib/agent/access.server.js';
import { startAgentTurn } from '#lib/agent/usage/turn.server.js';

import {
	isAgentToolContinuation,
	lastAgentUserText,
	textFromAgentParts,
	type CoachThinkingMode,
	type AgentContext,
	type AgentRequest
} from '#lib/agent/request.js';
import {
	buildAgentUiMessages,
	reconstructApprovalContinuationMessage
} from '#lib/agent/conversations/history.server.js';
import {
	appendConversationMessage,
	ensureConversation,
	getAgentHistory,
	ConversationAccessError,
	finalizeConversationMessage,
	linkCoachAuditsToAssistantMessage,
	markConversationMessageStreaming,
	type ConversationMessage
} from '#lib/agent/conversations/store.server.js';
import { coachComposerActionInstructions } from '#lib/agent/personalization/composer-actions.js';
import { timezoneFromCookies } from '#lib/users/timezone.js';
import {
	prepareCoachImageParts,
	linkCoachImage,
	coachImageModelMessages,
	coachImageManifest
} from '#lib/agent/attachments/images.server.js';
import { CoachImageError } from '#lib/agent/attachments/validation.server.js';

const AGENT_REQUEST_TIMEOUT_MS = 55_000;

type ContinuationToolPart = {
	type?: unknown;
	state?: unknown;
	toolCallId?: unknown;
};

function findContinuationToolPart(
	parts: unknown[],
	states: readonly string[]
): ContinuationToolPart | null {
	for (let index = parts.length - 1; index >= 0; index -= 1) {
		const part = parts[index];
		if (!part || typeof part !== 'object') continue;
		const candidate = part as ContinuationToolPart;
		if (
			typeof candidate.type === 'string' &&
			candidate.type.startsWith('tool-') &&
			typeof candidate.toolCallId === 'string' &&
			states.includes(typeof candidate.state === 'string' ? candidate.state : '')
		) {
			return candidate;
		}
	}
	return null;
}

export type AgentStreamOptions = {
	event: RequestEvent;
	userId: string;
	sessionId: string;
	accessReason: SuperAccessReason;
	context: AgentContext;
	messages: AgentRequest['messages'];
	conversationId?: string;
	coachActions?: AgentRequest['coachActions'];
	thinkingMode?: CoachThinkingMode;
};

function rateLimitedResponse(retryAt: number | null): Response {
	return Response.json(
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

export async function createAgentStreamResponse(options: AgentStreamOptions): Promise<Response> {
	const deadline = Date.now() + AGENT_REQUEST_TIMEOUT_MS;
	const {
		event,
		userId,
		sessionId,
		accessReason,
		context,
		messages,
		conversationId: requestedConversationId,
		coachActions,
		thinkingMode = 'quick'
	} = options;
	const surface = context.surface;
	const timeZone = timezoneFromCookies(event.cookies) ?? 'UTC';
	const errorLabel = 'Coach';
	const clientMessages = messages;
	const isContinuation = isAgentToolContinuation(clientMessages);
	if (isContinuation && !requestedConversationId) {
		return Response.json(
			{ error: 'A conversation is required to continue that practice question.' },
			{ status: 400 }
		);
	}

	const personalizedTurn = await startAgentTurn(userId, accessReason);
	if (personalizedTurn.kind === 'rate-limited')
		return rateLimitedResponse(personalizedTurn.retryAt);
	if (personalizedTurn.kind === 'exhausted') {
		return Response.json(
			{
				error: `Your ${formatCreditsFromMilli(monthlyCreditLimitMilli(accessReason))} Coach credits for this month have been used.`
			},
			{ status: 429 }
		);
	}

	const lock = await acquireCoachLock(userId);
	if (!lock) {
		return Response.json(
			{ error: 'Another personalized AI request is still running.' },
			{ status: 409 }
		);
	}

	let cleanedUp = false;
	const streamTimeout = new AbortController();
	const streamTimeoutId = setTimeout(
		() => streamTimeout.abort(),
		Math.max(1, deadline - Date.now())
	);
	const refreshTimer = setInterval(() => {
		void refreshLock(lock).catch(() => undefined);
	}, 30_000);
	const cleanup = async () => {
		if (cleanedUp) return;
		cleanedUp = true;
		clearTimeout(streamTimeoutId);
		clearInterval(refreshTimer);
		await releaseLock(lock);
	};
	let assistantMessageId: string | undefined;
	let pendingAssistant: ConversationMessage | undefined;
	let conversationId: string | undefined;
	try {
		let turnUsage: LanguageModelUsage = createEmptyLanguageModelUsage();
		let simulationUsd = 0;
		const incomingUserText = lastAgentUserText(clientMessages);
		const incomingUser = [...clientMessages].reverse().find((message) => message.role === 'user');
		if (
			!incomingUserText &&
			!incomingUser?.parts.some((part) => part.type === 'file') &&
			!isContinuation
		) {
			await cleanup();
			return Response.json({ error: 'The Super Agent needs a student message.' }, { status: 400 });
		}

		const profile = await getTutorProfileViewForRequest(event.locals, userId);
		const ownedConversation = await ensureConversation(userId, {
			conversationId: requestedConversationId,
			surface,
			context,
			...(!requestedConversationId && !isContinuation
				? {
						title: incomingUserText
							? fallbackConversationTitle(incomingUserText, surface)
							: 'Attachment discussion',
						automaticTitlePending: Boolean(incomingUserText)
					}
				: {})
		});
		conversationId = ownedConversation.id;
		const storedMessages = await getAgentHistory(ownedConversation);

		let imageUpload: { id: string; bytes: Buffer } | undefined;
		if (!isContinuation) {
			let incomingParts = incomingUser?.parts ?? [];
			if (incomingUser?.id && incomingParts.some((part) => part.type === 'file')) {
				const saved = storedMessages.find((row) => row.clientMessageId === incomingUser.id);
				if (saved) incomingParts = saved.parts as typeof incomingParts;
			}
			const prepared = await prepareCoachImageParts(userId, conversationId, incomingParts);
			imageUpload = prepared.upload;
			const userMessageId = await appendConversationMessage(
				userId,
				{
					conversationId,
					role: 'user',
					content: incomingUserText,
					parts: prepared.savedParts,
					clientMessageId: incomingUser?.id,
					status: 'complete'
				},
				ownedConversation
			);
			const savedUser = storedMessages.find((row) => row.id === userMessageId);
			if (!savedUser)
				storedMessages.push({
					id: userMessageId,
					role: 'user',
					content: incomingUserText,
					parts: prepared.savedParts,
					position: (storedMessages.at(-1)?.position ?? -1) + 1,
					status: 'complete',
					clientMessageId: incomingUser?.id
				});
			if (imageUpload) await linkCoachImage(imageUpload.id, userId, conversationId, userMessageId);
		}

		let continuationMessage: AgentUIMessage | undefined;
		if (isContinuation) {
			const clientAssistant = clientMessages.at(-1);
			const clientToolPart = clientAssistant
				? findContinuationToolPart(clientAssistant.parts, [
						'output-available',
						'output-error',
						'approval-responded'
					])
				: null;
			const lastAssistant = [...storedMessages]
				.reverse()
				.find((message) => message.role === 'assistant');
			if (!lastAssistant) {
				await cleanup();
				const continuationError = 'Pip could not continue that practice question.';
				return Response.json({ error: continuationError }, { status: 409 });
			}
			const storedToolPart = findContinuationToolPart(lastAssistant.parts, [
				'input-available',
				'input-streaming',
				'approval-requested'
			]);
			if (
				!clientToolPart ||
				!storedToolPart ||
				clientToolPart.type !== storedToolPart.type ||
				clientToolPart.toolCallId !== storedToolPart.toolCallId
			) {
				await cleanup();
				return Response.json(
					{ error: 'That practice question is no longer pending.' },
					{ status: 409 }
				);
			}
			if (
				storedToolPart.state === 'approval-requested' ||
				clientToolPart.state === 'approval-responded'
			) {
				continuationMessage = clientAssistant
					? (reconstructApprovalContinuationMessage(lastAssistant, clientAssistant) ?? undefined)
					: undefined;
				if (!continuationMessage) {
					await cleanup();
					return Response.json({ error: 'That approval is no longer pending.' }, { status: 409 });
				}
			}
			assistantMessageId = lastAssistant.id;
			pendingAssistant = lastAssistant;
			await markConversationMessageStreaming(userId, assistantMessageId);
		} else {
			assistantMessageId = await appendConversationMessage(
				userId,
				{
					conversationId,
					role: 'assistant',
					status: 'streaming'
				},
				ownedConversation
			);
		}

		const { messages: uiMessages, historySummary } = buildAgentUiMessages({
			stored: storedMessages,
			context: ownedConversation.context ?? {},
			clientMessages,
			isContinuation,
			continuationMessage,
			streamingAssistantMessageId: assistantMessageId
		});
		const lastUserMessage = lastAgentUserText(
			uiMessages
				.filter((message) => message.role === 'user' || message.role === 'assistant')
				.map((message) => ({
					role: message.role as 'user' | 'assistant',
					parts: message.parts as AgentRequest['messages'][number]['parts']
				}))
		);

		const personalization = await buildAgentContext(userId, lastUserMessage, context, profile);
		const memoryConsentGiven = Boolean(profile.memoryDisclosureSeenAt);
		const agent = createAgent({
			locals: event.locals,
			userId,
			allowUserAnalytics: hasAnalyticsConsent(event.request),
			sessionId,
			selectedApClasses: profile.selectedApClasses,
			timeZone,
			personalizationContext: personalization.text,
			historySummary: [historySummary, await coachImageManifest(userId, conversationId)]
				.filter(Boolean)
				.join('\n\n'),
			currentContext: context,
			conversationId,
			composerActionInstructions: coachComposerActionInstructions(coachActions ?? []),
			thinkingMode,
			canAffordWebSearch: personalizedTurn.canAffordWebSearch,
			recordGenerationUsage: (usage) => {
				simulationUsd += usdFromLanguageModelUsage(usage, SIM_MODEL);
			},
			recordWebSearch: personalizedTurn.recordWebSearch,
			onGenerationEnd: (usage) => {
				turnUsage = usage;
			}
		});

		const markUsageIfNeeded = async (responseMessage: AgentUIMessage) => {
			const hasBillableOutput = responseMessage.parts.some((part) => {
				if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
					return part.text.trim().length > 0;
				}
				return typeof part.type === 'string' && part.type.startsWith('tool-');
			});
			if (!hasBillableOutput) return;
			try {
				await personalizedTurn.chargeUsage(turnUsage, simulationUsd);
			} catch (error) {
				logger.warn('Failed to roll up Super Agent usage', { error });
			}
		};

		streamTimeout.signal.throwIfAborted();
		const response = await createAgentUIStreamResponse({
			agent,
			uiMessages: coachImageModelMessages(uiMessages, imageUpload),
			abortSignal: AbortSignal.any([event.request.signal, streamTimeout.signal]),
			consumeSseStream: consumeStream,
			timeout: Math.max(1, deadline - Date.now()),
			originalMessages: uiMessages,
			onStepEnd: (step) => {
				turnUsage = addLanguageModelUsage(turnUsage, step.usage);
				logger.info('Super Agent step finish', {
					surface,
					conversationId,
					stepNumber: step.stepNumber,
					finishReason: step.finishReason,
					toolCallNames: step.toolCalls.flatMap((call) => (call ? [call.toolName] : [])),
					toolResultNames: step.toolResults.flatMap((result) => (result ? [result.toolName] : [])),
					inputTokens: step.usage.inputTokens,
					outputTokens: step.usage.outputTokens,
					totalTokens: step.usage.totalTokens,
					uiMessageCount: uiMessages.length,
					modelId: step.model.modelId
				});
			},
			onEnd: async ({ responseMessage, isAborted }) => {
				try {
					await markUsageIfNeeded(responseMessage);
					const assistantResponse = textFromAgentParts(
						responseMessage.parts as Array<{ type?: string; text?: string }>
					);
					if (assistantMessageId && conversationId) {
						await finalizeConversationMessage(userId, assistantMessageId, {
							content: assistantResponse,
							parts: responseMessage.parts as unknown[],
							clientMessageId: responseMessage.id,
							status: isAborted ? 'aborted' : 'complete'
						});
						if (conversationId) {
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
							scheduleBackgroundTask(
								addTutorMemoryExchange(
									userId,
									{ user: lastUserMessage, assistant: assistantResponse },
									{ surface: 'coach' }
								).catch((error) => logger.warn('Coach memory update failed', { error }))
							);
						}
					}
				} finally {
					if (conversationId && storedMessages.length)
						scheduleBackgroundTask(
							summarizeConversation(
								userId,
								conversationId,
								storedMessages.slice(-96)[0].position,
								Math.max(1, Math.min(10_000, deadline + 5_000 - Date.now()))
							).catch((error) => logger.warn('Conversation summary failed', { error }))
						);
					await cleanup();
				}
			},
			onError: (error) => {
				// Provider errors can carry the full request, including private image bytes.
				logger.error(`${errorLabel} stream error`, {
					errorType: error instanceof Error ? error.name : 'UnknownError'
				});
				return 'The personalized AI could not complete that request. Please try again.';
			},
			headers: {
				...(imageUpload ? { 'X-Coach-Image-Id': imageUpload.id } : {}),
				'Cache-Control': 'no-cache',
				'X-Super-Conversation-Id': conversationId,
				'X-Tutor-Personalization-Degraded': personalization.memoryDegraded ? '1' : '0',
				'X-Super-Usage-Remaining': formatCreditsFromMilli(personalizedTurn.usage.remaining),
				...(personalizedTurn.usageWarning
					? { 'X-Super-Usage-Warning': String(personalizedTurn.usageWarning) }
					: {})
			}
		});
		if (ownedConversation.context?.automaticTitlePending)
			scheduleBackgroundTask(
				updateAutomaticTitle(
					userId,
					conversationId,
					String(ownedConversation.context.automaticTitlePrompt ?? ownedConversation.title),
					Math.max(1, Math.min(8_000, deadline - Date.now()))
				).catch((error) => logger.warn('Conversation title failed', { error }))
			);
		return response;
	} catch (error) {
		if (assistantMessageId) {
			await finalizeConversationMessage(userId, assistantMessageId, {
				content: pendingAssistant?.content ?? '',
				parts: pendingAssistant?.parts ?? [],
				status: pendingAssistant ? 'complete' : 'error'
			}).catch((finalizeError) =>
				logger.warn('Failed to finalize Super Agent error message', { finalizeError })
			);
		}
		await cleanup();
		if (error instanceof CoachImageError)
			return Response.json({ error: error.message }, { status: 400 });
		if (error instanceof ConversationAccessError) {
			return Response.json({ error: error.message }, { status: error.status });
		}
		if (messages.some((message) => message.parts.some((part) => part.type === 'file'))) {
			logger.error('Coach attachment request failed', {
				errorType: error instanceof Error ? error.name : 'UnknownError'
			});
			return Response.json(
				{ error: 'Coach could not process that attachment. Please try again.' },
				{ status: 500 }
			);
		}
		throw error;
	}
}
