import { z } from 'zod';
import type { StudyPlanInsights } from '$lib/super/types';

export const studyPlanInsightsSchema = z.object({
	generatedAt: z.string().trim().min(1),
	window: z.object({
		startsOn: z.string().trim().min(1),
		endsOn: z.string().trim().min(1),
		days: z.number().int().positive()
	}),
	metrics: z.object({
		mcqAttempts: z.number().int().nonnegative(),
		mcqAccuracy: z.number().int().nullable(),
		frqSubmissions: z.number().int().nonnegative(),
		frqAveragePercentage: z.number().int().nullable(),
		activeDays: z.number().int().nonnegative(),
		previousMcqAttempts: z.number().int().nonnegative(),
		previousMcqAccuracy: z.number().int().nullable()
	}),
	headline: z.string().trim().min(1),
	summary: z.string().trim().min(1),
	focusAreas: z.array(
		z.object({
			kind: z.enum(['focus', 'momentum', 'habit']),
			title: z.string().trim().min(1),
			detail: z.string().trim().min(1),
			why: z.string().trim().min(1),
			apClass: z.string().trim().min(1).nullable(),
			unit: z.string().trim().min(1).nullable()
		})
	),
	planRationale: z.string().trim().min(1)
});

export function parseStudyPlanInsights(value: unknown): StudyPlanInsights | null {
	const parsed = studyPlanInsightsSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
