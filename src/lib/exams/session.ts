import { z } from 'zod';

// An exam's structure is fixed at creation. Responses are keyed by item ID so
// saving one response never requires the client to replace the question set.
export const examSectionSchema = z
	.object({
		id: z.string().min(1).max(128),
		kind: z.enum(['mcq', 'frq']),
		title: z.string().min(1).max(200),
		timeLimitMs: z.number().int().positive().max(86_400_000).nullable(),
		items: z
			.array(
				z
					.object({ id: z.string().min(1).max(128), questionId: z.string().min(1).max(128) })
					.strict()
			)
			.min(1)
			.max(200)
	})
	.strict();

export const startExamSchema = z
	.object({
		course: z.string().trim().min(1).max(200),
		sections: z.array(examSectionSchema).min(1).max(20)
	})
	.strict()
	.superRefine(({ sections }, ctx) => {
		const sectionsSeen = new Set<string>();
		const itemsSeen = new Set<string>();
		for (const section of sections) {
			if (sectionsSeen.has(section.id))
				ctx.addIssue({ code: 'custom', message: 'Duplicate section ID' });
			sectionsSeen.add(section.id);
			for (const item of section.items) {
				if (itemsSeen.has(item.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate item ID' });
				itemsSeen.add(item.id);
			}
		}
	});

export const saveExamSchema = z
	.object({
		revision: z.number().int().nonnegative(),
		responses: z.record(z.string().min(1).max(128), z.string().max(50_000)),
		submit: z.boolean().optional().default(false)
	})
	.strict()
	.superRefine(({ responses }, ctx) => {
		if (Object.values(responses).reduce((total, value) => total + value.length, 0) > 500_000) {
			ctx.addIssue({ code: 'custom', message: 'Responses are too large' });
		}
	});

export type ExamSection = z.infer<typeof examSectionSchema>;
