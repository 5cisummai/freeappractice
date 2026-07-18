import { z } from 'zod';

export const FRQ_SCHEMA_VERSION = 1 as const;
export const MAX_FRQ_SECTION_RESPONSE_CHARS = 12_000;
export const MAX_FRQ_TOTAL_RESPONSE_CHARS = 40_000;

const stableId = z
	.string()
	.trim()
	.min(1)
	.max(80)
	.regex(/^[A-Za-z0-9._:()-]+$/, 'IDs may only contain stable label characters');

export const FrqMaterialSchema = z
	.object({
		id: stableId,
		title: z.string().trim().min(1).max(160).optional(),
		content: z.string().trim().min(1).max(20_000)
	})
	.strict();

export const FrqSectionSchema = z
	.object({
		id: stableId,
		label: z.string().trim().min(1).max(40),
		prompt: z.string().trim().min(1).max(8_000),
		responseKind: z.literal('text'),
		maxPoints: z.number().int().min(1).max(12)
	})
	.strict();

const FrqRubricLevelSchema = z
	.object({
		points: z.number().int().min(0).max(12),
		description: z.string().trim().min(1).max(4_000)
	})
	.strict();

export const FrqRubricCriterionSchema = z
	.object({
		id: stableId,
		sectionId: stableId,
		label: z.string().trim().min(1).max(160),
		maxPoints: z.number().int().min(1).max(12),
		levels: z.array(FrqRubricLevelSchema).min(2).max(13),
		referenceAnswer: z.string().trim().min(1).max(8_000)
	})
	.strict();

export const FrqQuestionSchema = z
	.object({
		schemaVersion: z.literal(FRQ_SCHEMA_VERSION),
		formatId: stableId,
		profileVersion: stableId,
		promptVersion: stableId,
		rubricVersion: stableId,
		prompt: z.string().trim().min(1).max(12_000),
		materials: z.array(FrqMaterialSchema).max(12),
		sections: z.array(FrqSectionSchema).min(1).max(12),
		rubric: z.array(FrqRubricCriterionSchema).min(1).max(30),
		totalPoints: z.number().int().min(1).max(100),
		topicsCovered: z.string().trim().min(1).max(1_000),
		apClass: z.string().trim().min(1).max(120),
		unit: z.string().trim().min(1).max(200)
	})
	.strict()
	.superRefine((question, context) => {
		const sectionIds = new Set<string>();
		for (const section of question.sections) {
			if (sectionIds.has(section.id)) {
				context.addIssue({ code: 'custom', message: `Duplicate section ID: ${section.id}` });
			}
			sectionIds.add(section.id);
		}

		const criterionIds = new Set<string>();
		let rubricTotal = 0;
		for (const criterion of question.rubric) {
			if (criterionIds.has(criterion.id)) {
				context.addIssue({ code: 'custom', message: `Duplicate criterion ID: ${criterion.id}` });
			}
			criterionIds.add(criterion.id);
			if (!sectionIds.has(criterion.sectionId)) {
				context.addIssue({
					code: 'custom',
					message: `Criterion ${criterion.id} references an unknown section`
				});
			}

			const points = criterion.levels.map((level) => level.points);
			if (new Set(points).size !== points.length || !points.includes(0)) {
				context.addIssue({
					code: 'custom',
					message: `Criterion ${criterion.id} needs unique levels including zero`
				});
			}
			if (Math.max(...points) !== criterion.maxPoints) {
				context.addIssue({
					code: 'custom',
					message: `Criterion ${criterion.id} levels must reach maxPoints`
				});
			}
			rubricTotal += criterion.maxPoints;
		}

		if (rubricTotal !== question.totalPoints) {
			context.addIssue({ code: 'custom', message: 'Rubric points must equal totalPoints' });
		}

		for (const section of question.sections) {
			const sectionTotal = question.rubric
				.filter((criterion) => criterion.sectionId === section.id)
				.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
			if (sectionTotal !== section.maxPoints) {
				context.addIssue({
					code: 'custom',
					message: `Rubric points for ${section.id} must equal the section maxPoints`
				});
			}
		}
	});

export type FrqQuestion = z.infer<typeof FrqQuestionSchema>;
export type FrqMaterial = z.infer<typeof FrqMaterialSchema>;
export type FrqSection = z.infer<typeof FrqSectionSchema>;
export type FrqRubricCriterion = z.infer<typeof FrqRubricCriterionSchema>;

export type PublicFrqQuestion = Omit<FrqQuestion, 'rubric'> & { questionId: string };

export const FrqGradeModelOutputSchema = z
	.object({
		criteria: z
			.array(
				z
					.object({
						criterionId: stableId,
						points: z.number().int().min(0).max(12),
						evidence: z.string().trim().max(2_000),
						feedback: z.string().trim().min(1).max(2_000)
					})
					.strict()
			)
			.min(1)
			.max(30),
		overallFeedback: z.string().trim().min(1).max(4_000)
	})
	.strict();

export type FrqCriterionGrade = z.infer<typeof FrqGradeModelOutputSchema>['criteria'][number] & {
	label: string;
	sectionId: string;
	pointsAvailable: number;
};

export type FrqGrade = {
	criteria: FrqCriterionGrade[];
	pointsEarned: number;
	pointsAvailable: number;
	percentage: number;
	overallFeedback: string;
};

export type FrqAttemptView = {
	id: string;
	questionId: string;
	apClass: string;
	unit: string;
	formatId: string;
	responses: Record<string, string>;
	grade: FrqGrade;
	timeTakenMs: number;
	attemptedAt: string;
	profileVersion: string;
	rubricVersion: string;
	model: string;
};

export const FrqGradeRequestSchema = z
	.object({
		questionId: z.string().uuid(),
		submissionId: z.string().uuid(),
		responses: z.record(z.string(), z.string().max(MAX_FRQ_SECTION_RESPONSE_CHARS)),
		timeTakenMs: z.number().finite().optional().default(0)
	})
	.strict()
	.superRefine((value, context) => {
		const responses = Object.values(value.responses);
		if (Object.keys(value.responses).length > 12) {
			context.addIssue({ code: 'custom', message: 'Too many response sections' });
		}
		if (!responses.some((response) => response.trim())) {
			context.addIssue({ code: 'custom', message: 'Write a response before submitting' });
		}
		const total = responses.reduce((sum, response) => sum + response.length, 0);
		if (total > MAX_FRQ_TOTAL_RESPONSE_CHARS) {
			context.addIssue({ code: 'custom', message: 'The complete response is too long' });
		}
	});

export type FrqGradeRequest = z.infer<typeof FrqGradeRequestSchema>;

export type FrqProgressSummary = {
	apClass: string;
	unit: string;
	attempts: number;
	pointsEarned: number;
	pointsAvailable: number;
	averagePercentage: number;
	lastAttemptAt?: string;
};

export function toPublicFrqQuestion(questionId: string, question: FrqQuestion): PublicFrqQuestion {
	const { rubric: _rubric, ...publicQuestion } = question;
	return { ...publicQuestion, questionId };
}
