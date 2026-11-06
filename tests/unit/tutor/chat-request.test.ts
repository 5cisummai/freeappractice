import { describe, expect, it } from 'vitest';
import {
	MAX_TUTOR_CHAT_HISTORY_MESSAGES,
	MAX_TUTOR_CHAT_PROMPT_CHARACTERS,
	tutorChatRequestSchema
} from '#lib/tutor/chat-request.js';

const validRequest = {
	questionId: 'c8f3048f-1681-47f2-b1db-e912655275d0',
	messages: [
		{ id: '1', role: 'assistant' as const, parts: [{ type: 'text' as const, text: 'Hi' }] },
		{ id: '2', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Explain further.' }] }
	]
};

describe('tutorChatRequestSchema', () => {
	it('accepts a well-formed request', () => {
		const parsed = tutorChatRequestSchema.parse(validRequest);
		expect(parsed.messages).toHaveLength(2);
	});

	it('rejects unknown keys under strict mode', () => {
		expect(() => tutorChatRequestSchema.parse({ ...validRequest, extra: true })).toThrow();
	});

	it('rejects conversation history beyond the message cap', () => {
		const messages = Array.from({ length: MAX_TUTOR_CHAT_HISTORY_MESSAGES + 3 }, (_, index) => ({
			id: String(index),
			role: 'user' as const,
			parts: [{ type: 'text' as const, text: 'hi' }]
		}));
		expect(() => tutorChatRequestSchema.parse({ ...validRequest, messages })).toThrow(/too long/i);
	});

	it('rejects payloads whose prompt characters exceed the limit', () => {
		const oversized = {
			...validRequest,
			messages: [
				{
					id: '1',
					role: 'user' as const,
					parts: [{ type: 'text' as const, text: 'q'.repeat(MAX_TUTOR_CHAT_PROMPT_CHARACTERS) }]
				}
			]
		};
		expect(() => tutorChatRequestSchema.parse(oversized)).toThrow(/too large/i);
	});
});
