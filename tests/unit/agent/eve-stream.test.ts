import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamEveTurn } from '#lib/agent/eve-stream.server.js';

vi.mock('#lib/agent/eve-turn.server.js', () => ({
	eveServiceSecret: () => 'secret',
	getEveToolRecord: vi.fn()
}));

afterEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllEnvs());

async function runEvents(events: Array<{ type: string; data: unknown }>) {
	vi.stubEnv('COACH_EVE_URL', 'https://eve.test');
	const send = vi.fn();
	const onUsage = vi.fn();
	const turnId = 'test-turn';
	vi.stubGlobal(
		'fetch',
		vi.fn(
			async () =>
				new Response(
					[...events, { type: 'delivery.settled', data: { outcome: 'handled' } }]
						.map((event) => JSON.stringify(event))
						.join('\n') + '\n',
					{ headers: { 'content-type': 'application/x-ndjson' } }
				)
		)
	);
	await streamEveTurn({
		turnId,
		deadline: Date.now() + 1_000,
		context: '',
		mode: 'quick',
		messages: [],
		continuing: false,
		signal: new AbortController().signal,
		writer: { write: send, merge: vi.fn(), onError: undefined },
		onUsage,
		onSimulationUsage: vi.fn()
	});
	return { chunks: send.mock.calls.map(([chunk]) => chunk), onUsage };
}

function requested(name: string, callId: string, input: unknown = {}) {
	return { type: 'call.requested', data: { callId, capability: { name, kind: 'tool' }, input } };
}

function settled(callId: string, output: unknown) {
	return { type: 'call.settled', data: { callId, outcome: 'completed', output } };
}

describe('Eve Coach event stream', () => {
	it.each([
		['ask_student', { question: 'Which day works?' }],
		['give_practice_question', { course: 'AP Calculus AB', mode: 'mcq' }]
	])(
		'preserves the pending %s call without sending its placeholder output',
		async (name, input) => {
			const { chunks, onUsage } = await runEvents([
				requested(name, 'call_inline', input),
				settled('call_inline', { pending: true }),
				{
					type: 'usage.recorded',
					data: {
						usage: { inputTokens: 12, outputTokens: 3, cacheReadTokens: 2, cacheWriteTokens: 0 }
					}
				}
			]);
			expect(chunks).toEqual([
				{ type: 'tool-input-available', toolName: name, toolCallId: 'call_inline', input }
			]);
			expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 15 }));
		}
	);

	it('delivers progress and answer segments in order without forwarding partial text', async () => {
		const { chunks } = await runEvents([
			requested('report_progress', 'progress'),
			settled('progress', { message: 'I’ll check your practice.' }),
			requested('send_message', 'segment'),
			settled('segment', { message: 'Start with derivatives.' }),
			{ type: 'content.delta', data: { kind: 'text', partId: 'final', delta: 'Try ' } },
			{ type: 'content.delta', data: { partId: 'final', delta: 'one now.' } },
			{ type: 'content.completed', data: { kind: 'text', partId: 'final' } }
		]);
		expect(
			chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.delta)
		).toEqual(['I’ll check your practice.', 'Start with derivatives.', 'Try one now.']);
	});

	it('emits one quoted reply and deduplicates its settlement', async () => {
		const result = settled('call_reply', { targetId: 'student', message: 'Try the product rule.' });
		const { chunks } = await runEvents([
			requested('reply_to_message', 'call_reply'),
			result,
			result
		]);
		expect(chunks).toEqual([
			{ type: 'data-coach-reply', id: 'call_reply', data: { targetId: 'student' } },
			{ type: 'text-start', id: 'test-turn:reply:call_reply' },
			{ type: 'text-delta', id: 'test-turn:reply:call_reply', delta: 'Try the product rule.' },
			{ type: 'text-end', id: 'test-turn:reply:call_reply' }
		]);
	});
});
