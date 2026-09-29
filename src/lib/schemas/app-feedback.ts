import { z } from 'zod';

export const APP_FEEDBACK_CATEGORIES = [
	'general',
	'bug',
	'feature_request',
	'content',
	'other'
] as const;

export type AppFeedbackCategory = (typeof APP_FEEDBACK_CATEGORIES)[number];

export const APP_FEEDBACK_CATEGORY_LABELS: Record<AppFeedbackCategory, string> = {
	general: 'General feedback',
	bug: 'Bug report',
	feature_request: 'Feature request',
	content: 'Question or content issue',
	other: 'Other'
};

export const coachFeedbackChatMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().max(16_000)
});

export const appFeedbackSchema = z
	.object({
		category: z.enum(APP_FEEDBACK_CATEGORIES),
		message: z.string().trim().min(10, 'Use at least 10 characters.').max(5000),
		coachMessageId: z.string().max(200).optional(),
		conversationId: z.string().max(200).optional(),
		chatHistory: z.array(coachFeedbackChatMessageSchema).max(150).optional()
	})
	.superRefine((value, ctx) => {
		if (value.chatHistory?.length && !value.coachMessageId) {
			ctx.addIssue({
				code: 'custom',
				message: 'Coach message ID is required when chat history is included.',
				path: ['coachMessageId']
			});
		}
	});

export type AppFeedbackPayload = z.infer<typeof appFeedbackSchema>;
export type CoachFeedbackChatMessage = z.infer<typeof coachFeedbackChatMessageSchema>;

const MAX_STORED_FEEDBACK_LENGTH = 50_000;

export function formatAppFeedbackMessageForStorage(payload: AppFeedbackPayload): string {
	const header: string[] = [];
	if (payload.coachMessageId) {
		header.push('[Coach Pip message feedback]');
		header.push(`Rated message ID: ${payload.coachMessageId}`);
		if (payload.conversationId) {
			header.push(`Conversation ID: ${payload.conversationId}`);
		}
	}

	let text = header.length ? `${header.join('\n')}\n\n${payload.message}` : payload.message;

	if (payload.chatHistory?.length) {
		const transcript = payload.chatHistory
			.map((entry) => `${entry.role === 'user' ? 'Student' : 'Pip'}: ${entry.content}`)
			.join('\n\n');
		text = `${text}\n\n---\nIncluded chat history:\n${transcript}`;
	}

	if (text.length > MAX_STORED_FEEDBACK_LENGTH) {
		return `${text.slice(0, MAX_STORED_FEEDBACK_LENGTH - 20)}\n...[truncated]`;
	}

	return text;
}
