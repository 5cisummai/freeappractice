import { logger } from '$lib/server/logger';
import type { chat, chatFrq } from '$lib/tutor/service.server';
import {
	TUTOR_CHAT_STREAM_TIMEOUT_MS,
	type FrqTutorChatRequest,
	type TutorChatRequest
} from '$lib/tutor/chat-request';

export type TutorChatFunction = typeof chat;
type FrqTutorChatFunction = typeof chatFrq;

type StreamCallbacks = {
	onFirstChunk?: () => Promise<void> | void;
	onFailureBeforeOutput?: () => Promise<void> | void;
	onComplete?: (assistantResponse: string) => Promise<unknown> | unknown;
};

async function runCallback(callback: (() => Promise<void> | void) | undefined): Promise<void> {
	if (!callback) return;
	try {
		await callback();
	} catch (error) {
		logger.error('Tutor stream lifecycle callback failed', { error });
	}
}

function createChatStream(
	requestSignal: AbortSignal,
	createGenerator: (signal: AbortSignal) => AsyncGenerator<string>,
	timeoutMs = TUTOR_CHAT_STREAM_TIMEOUT_MS,
	callbacks: StreamCallbacks = {}
): ReadableStream<Uint8Array> {
	const providerController = new AbortController();
	const encoder = new TextEncoder();
	let cancelled = false;
	let timedOut = false;
	let emittedOutput = false;

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

			let assistantResponse = '';
			try {
				for await (const chunk of createGenerator(providerController.signal)) {
					if (cancelled) return;
					if (!emittedOutput) {
						emittedOutput = true;
						await runCallback(callbacks.onFirstChunk);
					}
					assistantResponse += chunk;
					enqueue({ content: chunk });
				}
				if (!cancelled) {
					try {
						const event = await callbacks.onComplete?.(assistantResponse);
						if (event !== undefined) enqueue(event);
					} catch (error) {
						logger.error('Tutor completion callback failed', { error });
					}
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				}
			} catch (error) {
				if (cancelled) return;
				if (!emittedOutput) await runCallback(callbacks.onFailureBeforeOutput);
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
			if (!emittedOutput) void runCallback(callbacks.onFailureBeforeOutput);
			abortProvider();
			cleanup();
		}
	});
}

export function createTutorChatStream(
	context: Omit<Parameters<TutorChatFunction>[0], 'conversationHistory' | 'userMessage' | 'signal'>,
	payload: TutorChatRequest,
	requestSignal: AbortSignal,
	options: { chatImpl: TutorChatFunction; timeoutMs?: number; callbacks?: StreamCallbacks }
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
		options.timeoutMs,
		options.callbacks
	);
}

export function createFrqTutorChatStream(
	context: Omit<
		Parameters<FrqTutorChatFunction>[0],
		'conversationHistory' | 'userMessage' | 'signal'
	>,
	payload: FrqTutorChatRequest,
	requestSignal: AbortSignal,
	options: { chatImpl: FrqTutorChatFunction; timeoutMs?: number; callbacks?: StreamCallbacks }
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
		options.timeoutMs,
		options.callbacks
	);
}
