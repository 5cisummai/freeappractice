import { z } from 'zod';
import type { FeedbackType, QualityVerdict, ReviewFilters } from './types.js';

const id = z.string().trim().min(1).max(200);
const verdict = z.enum(['good', 'bad'] satisfies [QualityVerdict, QualityVerdict]);

export const reviewFiltersSchema = z
	.object({
		apClass: z.string().trim().max(100).optional(),
		unit: z.string().trim().max(100).optional(),
		qualityState: z.enum(['unreviewed', 'awaiting_human', 'final']).optional(),
		createdAfter: z.string().trim().max(80).optional(),
		createdBefore: z.string().trim().max(80).optional(),
		minimumAgeDays: z.number().finite().min(0).max(3650).optional(),
		maxCount: z.number().int().min(1).max(10_000).optional()
	})
	.strict() satisfies z.ZodType<ReviewFilters>;

const base = z.object({ action: z.string().trim().min(1).max(40) });

export const questionQualityRequestSchema = z.discriminatedUnion('action', [
	base.extend({ action: z.literal('preview'), filters: reviewFiltersSchema.optional() }),
	base.extend({ action: z.literal('create'), previewId: id }),
	base.extend({ action: z.literal('refresh'), jobId: id }),
	base.extend({ action: z.literal('pause'), jobId: id }),
	base.extend({ action: z.literal('resume'), jobId: id }),
	base.extend({ action: z.literal('cancel'), jobId: id }),
	base.extend({
		action: z.literal('humanDecision'),
		questionId: id,
		verdict,
		notes: z.string().trim().max(10_000).default('')
	}),
	base.extend({ action: z.literal('reconcile'), hydrateMetadata: z.boolean().optional() })
]);

export const feedbackRequestSchema = z
	.object({
		questionId: id,
		type: z.enum(['answer_incorrect', 'question_unclear', 'explanation_unclear'] satisfies [
			FeedbackType,
			FeedbackType,
			FeedbackType
		]),
		apClass: z.string().trim().max(100).optional(),
		unit: z.string().trim().max(100).optional()
	})
	.strict();
