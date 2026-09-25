import { z } from 'zod';

export const coachQuestionToolInputSchema = z.object({
	question: z.string().trim().min(1).max(500),
	options: z.array(z.string().trim().min(1).max(120)).min(2).max(5).optional()
});

export const coachQuestionToolOutputSchema = z.discriminatedUnion('status', [
	z.object({ status: z.literal('answered'), response: z.string().trim().min(1).max(1000) }),
	z.object({ status: z.literal('skipped') })
]);

export type CoachQuestionToolInput = z.infer<typeof coachQuestionToolInputSchema>;
export type CoachQuestionToolOutput = z.infer<typeof coachQuestionToolOutputSchema>;

export function getCoachQuestionToolInput(value: unknown): CoachQuestionToolInput | null {
	const parsed = coachQuestionToolInputSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function getCoachQuestionToolOutput(value: unknown): CoachQuestionToolOutput | null {
	const parsed = coachQuestionToolOutputSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
