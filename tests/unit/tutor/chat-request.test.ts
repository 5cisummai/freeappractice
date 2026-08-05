import { describe, expect, it } from 'vitest';
import {
	MAX_TUTOR_CHAT_HISTORY_MESSAGES,
	MAX_TUTOR_CHAT_PROMPT_CHARACTERS,
	tutorChatRequestSchema
} from '$lib/tutor/chat-request';

const validRequest = {
	questionId: 'c8f3048f-1681-47f2-b1db-e912655275d0',
	conversationHistory: [{ role: 'user' as const, content: 'Give me a hint.' }],
	message: 'Explain further.'
};

describe('tutorChatRequestSchema', () => {
	it('accepts a well-formed request', () => {
		const parsed = tutorChatRequestSchema.parse(validRequest);
		expect(parsed.message).toBe('Explain further.');
		expect(parsed.conversationHistory).toHaveLength(1);
	});

	it('defaults optional fields', () => {
		const parsed = tutorChatRequestSchema.parse({
			questionId: validRequest.questionId,
			message: 'Help'
		});
		expect(parsed.conversationHistory).toEqual([]);
	});

	it('rejects unknown keys under strict mode', () => {
		expect(() => tutorChatRequestSchema.parse({ ...validRequest, extra: true })).toThrow();
	});

	it('rejects conversation history beyond the message cap', () => {
		const conversationHistory = Array.from({ length: MAX_TUTOR_CHAT_HISTORY_MESSAGES + 1 }, () => ({
			role: 'user' as const,
			content: 'hi'
		}));
		expect(() => tutorChatRequestSchema.parse({ ...validRequest, conversationHistory })).toThrow(
			/too long/i
		);
	});

	it('rejects payloads whose prompt characters exceed the limit', () => {
		const oversized = {
			...validRequest,
			conversationHistory: [
				{ role: 'user' as const, content: 'q'.repeat(MAX_TUTOR_CHAT_PROMPT_CHARACTERS) }
			],
			message: 'm'
		};
		expect(() => tutorChatRequestSchema.parse(oversized)).toThrow(/too large/i);
	});
});
