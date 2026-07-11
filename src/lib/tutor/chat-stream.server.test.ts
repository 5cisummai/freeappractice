import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTutorChatStream, type TutorChatFunction } from './chat-stream.server.ts';
import type { TutorChatRequest } from './chat-request.ts';

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

	assert.match(text, /data: {"content":"Start with the mitochondria\."}/);
	assert.match(text, /data: \[DONE\]/);
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

	assert.equal(providerSignal?.aborted, true);
	assert.match(text, /Tutor chat timed out/);
});

test('cancelling the response aborts provider work', async () => {
	let providerSignal: AbortSignal | undefined;
	const aborted = new Promise<void>((resolve) => {
		const chatImpl: TutorChatFunction = async function* (options) {
			yield* [];
			providerSignal = options.signal;
			options.signal?.addEventListener('abort', () => resolve(), { once: true });
			await new Promise(() => undefined);
		};
		const stream = createTutorChatStream(payload, new AbortController().signal, { chatImpl });
		void stream.cancel();
	});

	await aborted;
	assert.equal(providerSignal?.aborted, true);
});
