import { logger } from '$lib/server/logger';
import type { chat, chatFrq } from '$lib/tutor/service.server';
import {
	TUTOR_CHAT_STREAM_TIMEOUT_MS,
	type FrqTutorChatRequest,
	type TutorChatRequest
} from '$lib/tutor/chat-request';

export type TutorChatFunction = typeof chat;
type FrqTutorChatFunction = typeof chatFrq;

function createChatStream(
	requestSignal: AbortSignal,
	createGenerator: (signal: AbortSignal) => AsyncGenerator<string>,
	timeoutMs = TUTOR_CHAT_STREAM_TIMEOUT_MS
): ReadableStream<Uint8Array> {
	const providerController = new AbortController();
	const encoder = new TextEncoder();
	let cancelled = false;
	let timedOut = false;

	const abortProvider = () => {
		if (!providerController.signal.aborted) providerController.abort();
	};
	const timeoutId = setTimeout(() => {
		timedOut = true;
		abortProvider();
	}, timeoutMs);
	requestSignal.addEventListener('abort', abortProvider, { once: true });

	const cleanup = () => {
		clearTimeout(timeoutId);
		requestSignal.removeEventListener('abort', abortProvider);
	};

	return new ReadableStream({
		async start(controller) {
			const enqueue = (value: unknown) => {
				controller.enqueue(encoder.encode('data: ' + JSON.stringify(value) + '\n\n'));
			};

			try {
				for await (const chunk of createGenerator(providerController.signal)) {
					if (cancelled) return;
					enqueue({ content: chunk });
				}
				if (!cancelled) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
			} catch (error) {
				if (cancelled) return;
				if (providerController.signal.aborted) {
					enqueue({ error: timedOut ? 'Tutor chat timed out' : 'Stream cancelled' });
				} else {
					logger.error('Tutor stream error', { error });
					enqueue({ error: 'Stream error occurred' });
				}
			} finally {
				cleanup();
				if (!cancelled) controller.close();
			}
		},
		cancel() {
			cancelled = true;
			abortProvider();
			cleanup();
		}
	});
}

export function createTutorChatStream(
	payload: TutorChatRequest,
	requestSignal: AbortSignal,
	options: { chatImpl: TutorChatFunction; timeoutMs?: number }
): ReadableStream<Uint8Array> {
	return createChatStream(
		requestSignal,
		(signal) =>
			options.chatImpl({
				question: payload.question,
				correctAnswer: payload.answer,
				explanation: payload.explanation,
				apClass: payload.apClass,
				unit: payload.unit,
				answerChoices: payload.answerChoices,
				conversationHistory: payload.conversationHistory,
				userMessage: payload.message,
				signal
			}),
		options.timeoutMs
	);
}

export function createFrqTutorChatStream(
	context: Omit<
		Parameters<FrqTutorChatFunction>[0],
		'conversationHistory' | 'userMessage' | 'signal'
	>,
	payload: FrqTutorChatRequest,
	requestSignal: AbortSignal,
	options: { chatImpl: FrqTutorChatFunction; timeoutMs?: number }
): ReadableStream<Uint8Array> {
	return createChatStream(
		requestSignal,
		(signal) =>
			options.chatImpl({
				...context,
				conversationHistory: payload.conversationHistory,
				userMessage: payload.message,
				signal
			}),
		options.timeoutMs
	);
}
