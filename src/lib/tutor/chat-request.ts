import { z } from 'zod';

export const MAX_TUTOR_CHAT_REQUEST_BYTES = 32 * 1024;
export const MAX_TUTOR_CHAT_PROMPT_CHARACTERS = 16_000;
export const MAX_TUTOR_CHAT_HISTORY_MESSAGES = 12;
export const TUTOR_CHAT_STREAM_TIMEOUT_MS = 30_000;

const tutorUiMessagePartSchema = z.looseObject({
	type: z.string().min(1).max(100),
	text: z.string().max(2_000).optional()
});

const tutorUiMessageSchema = z.looseObject({
	id: z.string().max(200).optional(),
	role: z.enum(['user', 'assistant', 'system']),
	parts: z.array(tutorUiMessagePartSchema).min(1).max(24)
});

function tutorPromptCharacters(
	messages: z.infer<typeof tutorUiMessageSchema>[],
	questionId: string,
	attemptId = ''
): number {
	let total = questionId.length + attemptId.length;
	for (const message of messages) {
		for (const part of message.parts) {
			if (part.type === 'text' && typeof part.text === 'string') {
				total += part.text.length;
			}
		}
	}
	return total;
}

export const tutorChatRequestSchema = z
	.object({
		questionId: z.string().uuid(),
		messages: z
			.array(tutorUiMessageSchema)
			.min(1, 'Tutor chat needs at least one message')
			.max(MAX_TUTOR_CHAT_HISTORY_MESSAGES + 2, 'Conversation history is too long'),
		id: z.string().max(200).optional(),
		trigger: z.string().max(100).optional(),
		messageId: z.string().max(200).optional()
	})
	.strict()
	.superRefine((value, context) => {
		if (
			tutorPromptCharacters(value.messages, value.questionId) > MAX_TUTOR_CHAT_PROMPT_CHARACTERS
		) {
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
		messages: z
			.array(tutorUiMessageSchema)
			.min(1, 'Tutor chat needs at least one message')
			.max(MAX_TUTOR_CHAT_HISTORY_MESSAGES + 2, 'Conversation history is too long'),
		id: z.string().max(200).optional(),
		trigger: z.string().max(100).optional(),
		messageId: z.string().max(200).optional()
	})
	.strict()
	.superRefine((value, context) => {
		if (
			tutorPromptCharacters(value.messages, value.questionId, value.attemptId) >
			MAX_TUTOR_CHAT_PROMPT_CHARACTERS
		) {
			context.addIssue({
				code: 'custom',
				message: 'Tutor chat context is too large'
			});
		}
	});

export type FrqTutorChatRequest = z.infer<typeof frqTutorChatRequestSchema>;
