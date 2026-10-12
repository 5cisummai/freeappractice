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
	const signal = AbortSignal.any([
		requestSignal,
		providerController.signal,
		AbortSignal.timeout(timeoutMs)
	]);

	return new ReadableStream({
		async start(controller) {
			const enqueue = (value: unknown) => {
				controller.enqueue(encoder.encode('data: ' + JSON.stringify(value) + '\n\n'));
			};

			try {
				signal.throwIfAborted();
				for await (const chunk of createGenerator(signal)) {
					if (cancelled) return;
					enqueue({ content: chunk });
				}
				if (!cancelled) {
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				}
			} catch (error) {
				if (cancelled) return;
				if (signal.aborted) {
					enqueue({
						error:
							signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
								? 'Tutor chat timed out'
								: 'Stream cancelled'
					});
				} else {
					logger.error('Tutor stream error', { error });
					enqueue({ error: 'Stream error occurred' });
				}
			} finally {
				if (!cancelled) controller.close();
			}
		},
		cancel() {
			cancelled = true;
			providerController.abort();
		}
	});
}

export function createTutorChatStream(
	context: Omit<Parameters<TutorChatFunction>[0], 'conversationHistory' | 'userMessage' | 'signal'>,
	payload: TutorChatRequest,
	requestSignal: AbortSignal,
	options: { chatImpl: TutorChatFunction; timeoutMs?: number }
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
