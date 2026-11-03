import {
	convertToModelMessages,
	createUIMessageStreamResponse,
	streamText,
	toUIMessageStream,
	type UIMessage
} from 'ai';
import { logger } from '#lib/server/logger.js';
import { TUTOR_CHAT_STREAM_TIMEOUT_MS } from '#lib/tutor/chat-request.js';
import { TUTOR_MODEL } from '#lib/tutor/service.server.js';

export async function createTutorStreamResponse(input: {
	operation: string;
	system: string;
	messages: UIMessage[];
	signal: AbortSignal;
	logMeta?: Record<string, unknown>;
	headers?: HeadersInit;
}): Promise<Response> {
	const signal = AbortSignal.any([input.signal, AbortSignal.timeout(TUTOR_CHAT_STREAM_TIMEOUT_MS)]);
	const doneAiCall = logger.aiCall(input.operation, TUTOR_MODEL, input.logMeta);
	try {
		const result = streamText({
			model: TUTOR_MODEL,
			instructions: input.system,
			messages: await convertToModelMessages(input.messages),
			maxOutputTokens: 500,
			abortSignal: signal,
			onFinish: ({ usage }) => {
				doneAiCall({ completionTokens: usage.outputTokens });
			}
		});

		return createUIMessageStreamResponse({
			stream: toUIMessageStream({ stream: result.stream }),
			headers: input.headers
		});
	} catch (error) {
		const aborted = signal.aborted || (error instanceof Error && error.name === 'AbortError');
		if (!aborted) {
			logger.error(`[ai] ${input.operation} failed`, { model: TUTOR_MODEL, error });
		}
		throw error;
	}
}
