import { z } from 'zod';

export const FRQ_SCHEMA_VERSION = 2 as const;
export const FRQ_ESSAY_RESPONSE_ID = 'essay';
const MAX_FRQ_PART_RESPONSE_CHARS = 12_000;
const MAX_FRQ_TOTAL_RESPONSE_CHARS = 40_000;

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

export const FrqPartSchema = z
	.object({
		id: stableId,
		label: z.string().trim().min(1).max(80),
		prompt: z.string().trim().min(1).max(8_000),
		points: z.number().int().min(1).max(12),
		earns: z.string().trim().min(1).max(4_000),
		answer: z.string().trim().min(1).max(8_000)
	})
	.strict();

const FrqQuestionBaseSchema = z
	.object({
		schemaVersion: z.literal(FRQ_SCHEMA_VERSION),
		formatId: stableId,
		responseMode: z.enum(['essay', 'parts']),
		prompt: z.string().trim().min(1).max(12_000),
		materials: z.array(FrqMaterialSchema).max(12),
		parts: z.array(FrqPartSchema).min(1).max(12),
		mainTopic: z.string().trim().min(1).max(240),
		topicsCovered: z.string().trim().min(1).max(1_000),
		course: z.string().trim().min(1).max(120),
		unit: z.string().trim().min(1).max(200)
	})
	.strict();

export const FrqQuestionSchema = FrqQuestionBaseSchema.superRefine((question, context) => {
	const partIds = new Set<string>();
	for (const part of question.parts) {
		if (partIds.has(part.id)) {
			context.addIssue({ code: 'custom', message: `Duplicate part ID: ${part.id}` });
		}
		partIds.add(part.id);
	}
});

export type FrqQuestion = z.infer<typeof FrqQuestionSchema>;
export type FrqMaterial = z.infer<typeof FrqMaterialSchema>;
export type FrqPart = z.infer<typeof FrqPartSchema>;
export type FrqResponseMode = FrqQuestion['responseMode'];

export const PublicFrqPartSchema = FrqPartSchema.omit({ answer: true, earns: true });

export const PublicFrqQuestionSchema = FrqQuestionBaseSchema.omit({ parts: true }).extend({
	questionId: stableId,
	parts: z.array(PublicFrqPartSchema).min(1).max(12)
});

export type PublicFrqPart = z.infer<typeof PublicFrqPartSchema>;
export type PublicFrqQuestion = z.infer<typeof PublicFrqQuestionSchema>;

export function frqTotalPoints(question: { parts: readonly { points: number }[] }): number {
	return question.parts.reduce((sum, part) => sum + part.points, 0);
}

export function frqResponseIds(question: {
	responseMode: FrqResponseMode;
	parts: readonly { id: string }[];
}): string[] {
	switch (question.responseMode) {
		case 'essay':
			return [FRQ_ESSAY_RESPONSE_ID];
		case 'parts':
			return question.parts.map((part) => part.id);
		default: {
			const exhaustive: never = question.responseMode;
			return exhaustive;
		}
	}
}

export function frqPartResponse(
	question: { responseMode: FrqResponseMode },
	responses: Record<string, string>,
	partId: string
): string {
	switch (question.responseMode) {
		case 'essay':
			return responses[FRQ_ESSAY_RESPONSE_ID]?.trim() ?? '';
		case 'parts':
			return responses[partId]?.trim() ?? '';
		default: {
			const exhaustive: never = question.responseMode;
			return exhaustive;
		}
	}
}

export const FrqGradeModelOutputSchema = z
	.object({
		parts: z
			.array(
				z
					.object({
						id: stableId,
						points: z.number().int().min(0).max(12),
						feedback: z.string().trim().min(1).max(2_000)
					})
					.strict()
			)
			.max(12),
		overallFeedback: z.string().trim().min(1).max(4_000)
	})
	.strict();

export type FrqPartGrade = {
	id: string;
	label: string;
	points: number;
	pointsAvailable: number;
	feedback: string;
};

export type FrqGrade = {
	parts: FrqPartGrade[];
	pointsEarned: number;
	pointsAvailable: number;
	percentage: number;
	overallFeedback: string;
};

export type FrqAttemptView = {
	id: string;
	questionId: string;
	course: string;
	unit: string;
	formatId: string;
	responses: Record<string, string>;
	grade: FrqGrade;
	timeTakenMs: number;
	attemptedAt: string;
	model: string;
};

export const FrqGradeRequestSchema = z
	.object({
		questionId: z.string().uuid(),
		submissionId: z.string().uuid(),
		responses: z.record(z.string(), z.string().max(MAX_FRQ_PART_RESPONSE_CHARS)),
		timeTakenMs: z.number().finite().optional().default(0)
	})
	.strict()
	.superRefine((value, context) => {
		const responses = Object.values(value.responses);
		if (Object.keys(value.responses).length > 12) {
			context.addIssue({ code: 'custom', message: 'Too many response parts' });
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
	course: string;
	unit: string;
	attempts: number;
	pointsEarned: number;
	pointsAvailable: number;
	averagePercentage: number;
	lastAttemptAt?: string;
};

export function toPublicFrqQuestion(questionId: string, question: FrqQuestion): PublicFrqQuestion {
	return {
		questionId,
		schemaVersion: question.schemaVersion,
		formatId: question.formatId,
		responseMode: question.responseMode,
		prompt: question.prompt,
		materials: question.materials,
		parts: question.parts.map(({ id, label, prompt, points }) => ({ id, label, prompt, points })),
		mainTopic: question.mainTopic,
		topicsCovered: question.topicsCovered,
		course: question.course,
		unit: question.unit
	};
}
