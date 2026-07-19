import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chat } from '$lib/tutor/service.server';
import { logger } from '$lib/server/logger';
import { capturePostHogServerEvent } from '$lib/server/posthog';
import { createTutorChatStream } from '$lib/tutor/chat-stream.server';
import { MAX_TUTOR_CHAT_REQUEST_BYTES, tutorChatRequestSchema } from '$lib/tutor/chat-request';

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
		const { apClass, unit, conversationHistory } = result.data;
		capturePostHogServerEvent(request, {
			distinctId: 'anonymous',
			event: 'tutor_chat_started',
			properties: {
				ap_class: apClass,
				unit,
				has_prior_conversation: conversationHistory.length > 0
			}
		});

		const stream = createTutorChatStream(result.data, request.signal, { chatImpl: chat });

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
