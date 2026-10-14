import { describe, expect, it, vi } from 'vitest';
import { createTutorChatStream, type TutorChatFunction } from '#lib/tutor/chat-stream.server.js';

const context = {
	question: 'Q',
	correctAnswer: 'A',
	explanation: 'E',
	course: 'AP Biology',
	unit: 'Unit 1',
	answerChoices: null
};
const payload = { questionId: 'question-1', message: 'Help', conversationHistory: [] };

function makeStream(
	chatImpl: TutorChatFunction,
	signal = new AbortController().signal,
	timeoutMs = 1000
) {
	return createTutorChatStream(context, payload, signal, { chatImpl, timeoutMs });
}

describe('standard Tutor streaming', () => {
	it('preserves the content envelopes and completion marker consumed by the existing UI', async () => {
		const stream = makeStream(async function* () {
			yield 'Think ';
			yield 'about cells.';
		});
		const text = await new Response(stream).text();
		expect(text).toBe(
			'data: {"content":"Think "}\n\ndata: {"content":"about cells."}\n\ndata: [DONE]\n\n'
		);
	});
	it('cancels provider work when the consumer cancels', async () => {
		let providerSignal: AbortSignal | undefined;
		const stream = makeStream(async function* ({ signal }) {
			providerSignal = signal;
			await new Promise<void>((_, reject) =>
				signal!.addEventListener('abort', () => reject(signal!.reason), { once: true })
			);
			yield 'unreachable';
		});
		await stream.cancel();
		expect(providerSignal?.aborted).toBe(true);
	});
	it('reports a timeout through the existing stream protocol', async () => {
		const stream = makeStream(
			async function* ({ signal }) {
				await new Promise<void>((_, reject) =>
					signal!.addEventListener('abort', () => reject(signal!.reason), { once: true })
				);
				yield 'unreachable';
			},
			undefined,
			10
		);
		expect(await new Response(stream).text()).toContain('Tutor chat timed out');
	});
	it('does not start provider work for an already aborted request', async () => {
		const request = new AbortController();
		request.abort();
		const provider = vi.fn(async function* () {
			yield 'unreachable';
		});
		expect(await new Response(makeStream(provider, request.signal)).text()).toContain(
			'Stream cancelled'
		);
		expect(provider).not.toHaveBeenCalled();
	});
});
