import { z } from 'zod';

export const MAX_TUTOR_CHAT_REQUEST_BYTES = 32 * 1024;
export const MAX_TUTOR_CHAT_PROMPT_CHARACTERS = 16_000;
export const MAX_TUTOR_CHAT_HISTORY_MESSAGES = 12;
export const TUTOR_CHAT_STREAM_TIMEOUT_MS = 30_000;

const boundedText = (field: string, max: number) =>
	z.string().trim().min(1, `${field} is required`).max(max, `${field} is too long`);

const optionalText = (field: string, max: number) =>
	z.string().trim().max(max, `${field} is too long`).optional().default('');

const tutorMessageSchema = z
	.object({
		role: z.enum(['user', 'assistant']),
		content: boundedText('Conversation message', 2_000)
	})
	.strict();

export const tutorChatRequestSchema = z
	.object({
		question: boundedText('Question', 4_000),
		answer: optionalText('Answer', 1_000),
		explanation: optionalText('Explanation', 6_000),
		apClass: optionalText('AP class', 100),
		unit: optionalText('Unit', 200),
		answerChoices: z
			.object({
				A: boundedText('Answer choice A', 1_000),
				B: boundedText('Answer choice B', 1_000),
				C: boundedText('Answer choice C', 1_000),
				D: boundedText('Answer choice D', 1_000)
			})
			.strict()
			.nullable()
			.optional()
			.default(null),
		conversationHistory: z
			.array(tutorMessageSchema)
			.max(MAX_TUTOR_CHAT_HISTORY_MESSAGES, 'Conversation history is too long')
			.optional()
			.default([]),
		message: boundedText('Message', 2_000)
	})
	.strict()
	.superRefine((value, context) => {
		const promptCharacters =
			value.question.length +
			value.answer.length +
			value.explanation.length +
			value.apClass.length +
			value.unit.length +
			(value.answerChoices ? Object.values(value.answerChoices).join('').length : 0) +
			value.conversationHistory.reduce((total, item) => total + item.content.length, 0) +
			value.message.length;

		if (promptCharacters > MAX_TUTOR_CHAT_PROMPT_CHARACTERS) {
			context.addIssue({
				code: 'custom',
				message: 'Tutor chat context is too large'
			});
		}
	});

export type TutorChatRequest = z.infer<typeof tutorChatRequestSchema>;
