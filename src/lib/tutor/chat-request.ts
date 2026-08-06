import { z } from 'zod';

export const MAX_TUTOR_CHAT_REQUEST_BYTES = 32 * 1024;
export const MAX_TUTOR_CHAT_PROMPT_CHARACTERS = 16_000;
export const MAX_TUTOR_CHAT_HISTORY_MESSAGES = 12;
export const TUTOR_CHAT_STREAM_TIMEOUT_MS = 30_000;

const boundedText = (field: string, max: number) =>
	z.string().trim().min(1, `${field} is required`).max(max, `${field} is too long`);

const tutorMessageSchema = z
	.object({
		role: z.enum(['user', 'assistant']),
		content: boundedText('Conversation message', 2_000)
	})
	.strict();

export const tutorChatRequestSchema = z
	.object({
		questionId: z.string().uuid(),
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
			value.questionId.length +
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

export const tutorGreetingRequestSchema = z.object({ questionId: z.string().uuid() }).strict();

export type TutorGreetingRequest = z.infer<typeof tutorGreetingRequestSchema>;

export const frqTutorChatRequestSchema = z
	.object({
		questionId: z.string().uuid(),
		attemptId: z
			.string()
			.trim()
			.regex(/^[a-f\d]{24}$/i, 'Attempt ID is invalid')
			.optional()
			.default(''),
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
			value.questionId.length +
			value.attemptId.length +
			value.conversationHistory.reduce((total, item) => total + item.content.length, 0) +
			value.message.length;

		if (promptCharacters > MAX_TUTOR_CHAT_PROMPT_CHARACTERS) {
			context.addIssue({
				code: 'custom',
				message: 'Tutor chat context is too large'
			});
		}
	});

export type FrqTutorChatRequest = z.infer<typeof frqTutorChatRequestSchema>;
