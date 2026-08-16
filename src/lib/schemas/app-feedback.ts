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

export const appFeedbackSchema = z.object({
	category: z.enum(APP_FEEDBACK_CATEGORIES),
	message: z.string().trim().min(10, 'Use at least 10 characters.').max(5000)
});

export type AppFeedbackPayload = z.infer<typeof appFeedbackSchema>;
