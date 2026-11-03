import { z } from 'zod';
import { AP_DATA } from '#lib/catalog/dataset.js';

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);
export const ChoiceExplanationsSchema = z.object({
	A: z.string().trim().min(1),
	B: z.string().trim().min(1),
	C: z.string().trim().min(1),
	D: z.string().trim().min(1)
});
export type ChoiceExplanations = z.infer<typeof ChoiceExplanationsSchema>;
export type McqEnrichment = {
	difficulty?: z.infer<typeof DifficultySchema> | null;
	subtopicId?: string | null;
	choiceExplanations?: ChoiceExplanations | null;
};
export const enrichmentFields = {
	difficulty: DifficultySchema.nullable().default(null),
	subtopicId: z.string().trim().min(1).nullable().default(null),
	choiceExplanations: ChoiceExplanationsSchema.nullable().default(null)
};
export function getMcqSubtopics(course: string, unit: string) {
	return (
		AP_DATA.courses
			.find((c) => c.name === course || c.id === course)
			?.units.find((u) => u.label === unit || u.id === unit)?.official.topicGroups ?? []
	);
}
export function normalizeMcqEnrichment(
	value: McqEnrichment | Record<string, unknown>
): Required<McqEnrichment> {
	const choices = ChoiceExplanationsSchema.safeParse(value.choiceExplanations);
	const difficulty = DifficultySchema.safeParse(value.difficulty);
	return {
		difficulty: difficulty.success ? difficulty.data : null,
		subtopicId:
			typeof value.subtopicId === 'string' && value.subtopicId.trim()
				? value.subtopicId.trim()
				: null,
		choiceExplanations: choices.success ? choices.data : null
	};
}
export function assertMcqSubtopic(
	course: string,
	unit: string,
	subtopicId: string | null | undefined
) {
	if (subtopicId && !getMcqSubtopics(course, unit).some((t) => t.id === subtopicId))
		throw new Error('MCQ subtopic does not belong to its course/unit');
}
export const DIFFICULTY_RUBRIC =
	'Judge difficulty relative to a prepared student in this AP course: easy = direct recall or straightforward application; medium = interpreting evidence or connecting a few reasoning steps; hard = integrating concepts or reasoning through unfamiliar representations. Length and tedious arithmetic do not imply difficulty. Flag defective questions rather than calling them hard.';
