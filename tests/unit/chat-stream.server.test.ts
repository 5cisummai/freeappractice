import { expect, test } from 'vitest';
import { createTutorChatStream, type TutorChatFunction } from '$lib/tutor/chat-stream.server';
import type { TutorChatRequest } from '$lib/tutor/chat-request';

const payload: TutorChatRequest = {
	question: 'What process produces ATP?',
	answer: 'Cellular respiration',
	explanation: '',
	apClass: 'AP Biology',
	unit: 'Unit 3',
	answerChoices: null,
	conversationHistory: [],
	message: 'Give me a hint.'
};

test('streams legitimate tutor output with the existing SSE contract', async () => {
	const chatImpl: TutorChatFunction = async function* () {
		yield 'Start with the mitochondria.';
	};
	const stream = createTutorChatStream(payload, new AbortController().signal, { chatImpl });
	const text = await new Response(stream).text();

	expect(text).toMatch(/data: {"content":"Start with the mitochondria\."}/);
	expect(text).toMatch(/data: \[DONE\]/);
});

test('aborts provider work and reports a timeout', async () => {
	let providerSignal: AbortSignal | undefined;
	const chatImpl: TutorChatFunction = async function* (options) {
		yield* [];
		providerSignal = options.signal;
		await new Promise<void>((_resolve, reject) => {
			options.signal?.addEventListener(
				'abort',
				() => reject(new DOMException('Aborted', 'AbortError')),
				{ once: true }
			);
		});
	};
	const stream = createTutorChatStream(payload, new AbortController().signal, {
		chatImpl,
		timeoutMs: 5
	});
	const text = await new Response(stream).text();

	expect(providerSignal?.aborted).toBe(true);
	expect(text).toMatch(/Tutor chat timed out/);
});

test('cancelling the response aborts provider work', async () => {
	let providerSignal: AbortSignal | undefined;
	const chatImpl: TutorChatFunction = async function* (options) {
		providerSignal = options.signal;
		await new Promise(() => undefined);
	};
	const stream = createTutorChatStream(payload, new AbortController().signal, { chatImpl });
	const reader = stream.getReader();
	void reader.read();

	while (!providerSignal) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	await reader.cancel();
	expect(providerSignal?.aborted).toBe(true);
});
