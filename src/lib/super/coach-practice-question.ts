import { z } from 'zod';
import type { AnswerResult } from '$lib/question-bank/mcq/types';
import type { FrqAttemptView } from '$lib/question-bank/frq/types';

export type CoachPracticeQuestionOption = {
	id: string;
	label: string;
	text: string;
};

export type CoachPracticeQuestionSection = {
	label: string;
	prompt: string;
};

export type CoachPracticeQuestionMaterial = {
	title?: string;
	content: string;
};

export type CoachPracticeQuestionOutput = {
	kind: 'practice_question';
	mode: 'mcq' | 'frq';
	questionId: string;
	apClass: string;
	unit: string;
	practiceHref: string;
	topic?: string;
	prompt: string;
	options?: CoachPracticeQuestionOption[];
	sections?: CoachPracticeQuestionSection[];
	materials?: CoachPracticeQuestionMaterial[];
	hasDiagram?: boolean;
	diagramSpec?: Record<string, unknown>;
};

export const coachPracticeQuestionToolInputSchema = z.object({
	apClass: z.string().trim().min(1).max(100),
	unit: z.string().trim().min(1).max(200).optional(),
	mode: z.enum(['mcq', 'frq']).default('mcq')
});

export type CoachPracticeQuestionToolInput = z.infer<typeof coachPracticeQuestionToolInputSchema>;

export const coachPracticeQuestionToolOutputSchema = z.object({
	status: z
		.enum(['answered', 'skipped'])
		.describe('Whether the student answered or skipped the inline question.'),
	mode: z.enum(['mcq', 'frq']).describe('Question type that was shown.'),
	questionId: z.string().min(1).describe('Bank question id that was served.'),
	apClass: z.string().min(1),
	unit: z.string().min(1),
	topic: z.string().optional(),
	prompt: z.string().min(1).describe('Question stem shown to the student.'),
	selectedAnswer: z
		.string()
		.optional()
		.describe('MCQ only: the letter the student chose. Omitted if skipped.'),
	isCorrect: z
		.boolean()
		.optional()
		.describe('MCQ only: whether the first submitted choice was correct. Omitted if skipped.'),
	timeTakenMs: z.number().int().nonnegative().optional(),
	frqPointsEarned: z.number().optional().describe('FRQ only: points earned after grading.'),
	frqPointsAvailable: z.number().optional().describe('FRQ only: total rubric points.'),
	frqFeedback: z.string().optional().describe('FRQ only: short overall grading feedback.')
});

export type CoachPracticeQuestionToolOutput = z.infer<
	typeof coachPracticeQuestionToolOutputSchema
>;

export function getCoachPracticeQuestionToolInput(value: unknown): CoachPracticeQuestionToolInput | null {
	const parsed = coachPracticeQuestionToolInputSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function getCoachPracticeQuestionToolOutput(
	value: unknown
): CoachPracticeQuestionToolOutput | null {
	const parsed = coachPracticeQuestionToolOutputSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function getCoachPracticeQuestionOutput(value: unknown): CoachPracticeQuestionOutput | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const output = value as Record<string, unknown>;
	if (
		output.kind !== 'practice_question' ||
		(output.mode !== 'mcq' && output.mode !== 'frq') ||
		typeof output.questionId !== 'string' ||
		typeof output.apClass !== 'string' ||
		typeof output.unit !== 'string' ||
		typeof output.practiceHref !== 'string' ||
		typeof output.prompt !== 'string'
	) {
		return null;
	}
	return output as unknown as CoachPracticeQuestionOutput;
}

export function buildCoachPracticeHref(input: {
	apClass: string;
	unit: string;
	mode: 'mcq' | 'frq';
	questionId: string;
}): string {
	const params = new URLSearchParams({
		apClass: input.apClass,
		unit: input.unit,
		questionId: input.questionId
	});
	if (input.mode === 'frq') params.set('mode', 'frq');
	return `/app/practice?${params.toString()}`;
}

export function buildCoachPracticeQuestionToolOutput(input: {
	status: 'answered' | 'skipped';
	question: CoachPracticeQuestionOutput;
	answer?: AnswerResult;
	frqAttempt?: FrqAttemptView;
}): CoachPracticeQuestionToolOutput {
	const { question, status, answer, frqAttempt } = input;
	return {
		status,
		mode: question.mode,
		questionId: question.questionId,
		apClass: question.apClass,
		unit: question.unit,
		topic: question.topic,
		prompt: question.prompt,
		...(answer?.selectedAnswer
			? {
					selectedAnswer: answer.selectedAnswer,
					isCorrect: answer.isCorrect,
					timeTakenMs: answer.timeTakenMs
				}
			: {}),
		...(frqAttempt?.grade
			? {
					frqPointsEarned: frqAttempt.grade.pointsEarned,
					frqPointsAvailable: frqAttempt.grade.pointsAvailable,
					frqFeedback: frqAttempt.grade.overallFeedback
				}
			: {})
	};
}

export function isCoachPracticeQuestionPending(part: {
	type?: string;
	state?: string;
}): boolean {
	return (
		part.type === 'tool-give_practice_question' &&
		(part.state === 'input-available' || part.state === 'input-streaming')
	);
}
