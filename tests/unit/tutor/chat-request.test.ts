import { describe, expect, it } from 'vitest';
import {
	MAX_TUTOR_CHAT_HISTORY_MESSAGES,
	MAX_TUTOR_CHAT_PROMPT_CHARACTERS,
	tutorChatRequestSchema
} from '$lib/tutor/chat-request';

const validRequest = {
	question: 'What process produces ATP?',
	answer: 'Cellular respiration',
	explanation: 'Cells convert energy.',
	apClass: 'AP Biology',
	unit: 'Unit 3',
	answerChoices: {
		A: 'Photosynthesis',
		B: 'Cellular respiration',
		C: 'Fermentation',
		D: 'Diffusion'
	},
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
			question: 'Q?',
			message: 'Help'
		});
		expect(parsed.answer).toBe('');
		expect(parsed.answerChoices).toBeNull();
		expect(parsed.conversationHistory).toEqual([]);
	});

	it('rejects unknown keys under strict mode', () => {
		expect(() =>
			tutorChatRequestSchema.parse({ ...validRequest, extra: true })
		).toThrow();
	});

	it('rejects conversation history beyond the message cap', () => {
		const conversationHistory = Array.from(
			{ length: MAX_TUTOR_CHAT_HISTORY_MESSAGES + 1 },
			() => ({ role: 'user' as const, content: 'hi' })
		);
		expect(() =>
			tutorChatRequestSchema.parse({ ...validRequest, conversationHistory })
		).toThrow(/too long/i);
	});

	it('rejects payloads whose prompt characters exceed the limit', () => {
		const oversized = {
			...validRequest,
			question: 'q'.repeat(MAX_TUTOR_CHAT_PROMPT_CHARACTERS),
			message: 'm'
		};
		expect(() => tutorChatRequestSchema.parse(oversized)).toThrow(/too large/i);
	});
});
