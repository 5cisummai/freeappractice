import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chat } from '$lib/tutor/service.server';
import { logger } from '$lib/server/logger';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import {
	MAX_TUTOR_CHAT_REQUEST_BYTES,
	TUTOR_CHAT_STREAM_TIMEOUT_MS,
	tutorChatRequestSchema
} from '$lib/tutor/chat-request';

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

export const POST: RequestHandler = async ({ request }) => {
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
		const {
			question,
			answer,
			explanation,
			apClass,
			unit,
			answerChoices,
			conversationHistory,
			message
		} = result.data;

		capturePostHogServerEvent(request, {
			distinctId: 'anonymous',
			event: 'tutor_chat_started',
			properties: {
				ap_class: apClass,
				unit: unit,
				has_prior_conversation: conversationHistory.length > 0
			}
		});

		const providerController = new AbortController();
		let cancelled = false;
		const abortProvider = () => {
			if (!providerController.signal.aborted) providerController.abort();
		};
		request.signal.addEventListener('abort', abortProvider, { once: true });
		const timeoutId = setTimeout(abortProvider, TUTOR_CHAT_STREAM_TIMEOUT_MS);
		const cleanup = () => {
			clearTimeout(timeoutId);
			request.signal.removeEventListener('abort', abortProvider);
		};

		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();
				const enqueue = (payload: unknown) => {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
				};

				try {
					const generator = chat({
						question,
						correctAnswer: answer,
						explanation: explanation,
						apClass: apClass,
						unit: unit,
						answerChoices,
						conversationHistory,
						userMessage: message,
						signal: providerController.signal
					});
					for await (const chunk of generator) {
						if (cancelled) return;
						enqueue({ content: chunk });
					}

					if (!cancelled) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				} catch (err) {
					if (cancelled) return;

					try {
						const aborted = providerController.signal.aborted;
						if (aborted) {
							const timedOut = !request.signal.aborted;
							enqueue({
								error: timedOut ? 'Tutor chat timed out' : 'Stream cancelled'
							});
						} else {
							logger.error('Tutor stream error', { error: err });
							enqueue({ error: 'Stream error occurred' });
						}
					} catch {
						// Client already disconnected.
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

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (err) {
		logger.error('Tutor chat error', { error: err });
		return json({ error: 'Failed to start tutor chat' }, { status: 500 });
	}
};
