import { describe, expect, it, vi } from 'vitest';

const streamTextMock = vi.hoisted(() => vi.fn());
const convertToModelMessagesMock = vi.hoisted(() => vi.fn());
const toUIMessageStreamMock = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => {
	const actual = await importOriginal<typeof import('ai')>();
	return {
		...actual,
		streamText: streamTextMock,
		convertToModelMessages: convertToModelMessagesMock,
		toUIMessageStream: toUIMessageStreamMock
	};
});

import { createTutorStreamResponse } from '#lib/tutor/chat-response.server.js';

describe('createTutorStreamResponse', () => {
	it('uses streamText and the UI message stream helpers from the AI SDK', async () => {
		const uiStream = new ReadableStream();
		streamTextMock.mockReturnValue({ stream: uiStream });
		convertToModelMessagesMock.mockResolvedValue([{ role: 'user', content: 'Help' }]);
		toUIMessageStreamMock.mockReturnValue(uiStream);

		const messages = [
			{ id: '1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Help' }] }
		];
		await createTutorStreamResponse({
			operation: 'chat',
			system: 'system prompt',
			messages,
			signal: new AbortController().signal
		});

		expect(convertToModelMessagesMock).toHaveBeenCalledWith(messages);
		expect(streamTextMock).toHaveBeenCalledWith(
			expect.objectContaining({
				instructions: 'system prompt',
				maxOutputTokens: 500
			})
		);
		expect(toUIMessageStreamMock).toHaveBeenCalledWith({ stream: uiStream });
	});

	it('returns 408 when the request is aborted instead of throwing', async () => {
		const controller = new AbortController();
		controller.abort();
		convertToModelMessagesMock.mockRejectedValueOnce(controller.signal.reason);

		const response = await createTutorStreamResponse({
			operation: 'chat',
			system: 'system prompt',
			messages: [
				{ id: '1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Help' }] }
			],
			signal: controller.signal
		});

		expect(response.status).toBe(408);
	});

	it('still throws non-abort failures', async () => {
		convertToModelMessagesMock.mockRejectedValueOnce(new Error('provider down'));

		await expect(
			createTutorStreamResponse({
				operation: 'chat',
				system: 'system prompt',
				messages: [
					{ id: '1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Help' }] }
				],
				signal: new AbortController().signal
			})
		).rejects.toThrow('provider down');
	});
});
