import { logger } from '$lib/server/logger';
import type { chat } from '$lib/tutor/service.server';
import { TUTOR_CHAT_STREAM_TIMEOUT_MS, type TutorChatRequest } from '$lib/tutor/chat-request';

export type TutorChatFunction = typeof chat;

export function createTutorChatStream(
	payload: TutorChatRequest,
	requestSignal: AbortSignal,
	options: { chatImpl: TutorChatFunction; timeoutMs?: number }
): ReadableStream<Uint8Array> {
	const chatImpl = options.chatImpl;
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
	}, options.timeoutMs ?? TUTOR_CHAT_STREAM_TIMEOUT_MS);
	requestSignal.addEventListener('abort', abortProvider, { once: true });

	const cleanup = () => {
		clearTimeout(timeoutId);
		requestSignal.removeEventListener('abort', abortProvider);
	};

	return new ReadableStream({
		async start(controller) {
			const enqueue = (value: unknown) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
			};

			try {
				const generator = chatImpl({
					question: payload.question,
					correctAnswer: payload.answer,
					explanation: payload.explanation,
					apClass: payload.apClass,
					unit: payload.unit,
					answerChoices: payload.answerChoices,
					conversationHistory: payload.conversationHistory,
					userMessage: payload.message,
					signal: providerController.signal
				});

				for await (const chunk of generator) {
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
