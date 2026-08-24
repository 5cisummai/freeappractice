import { and, desc, eq } from 'drizzle-orm';
import { getFrqCourseProfile } from '$lib/question-bank/frq/profiles.server';
import { mcqBank } from '$lib/question-bank/mcq/bank.server';
import { frqBank } from '$lib/question-bank/frq/bank.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqAttempts, mcqAttempts } from '$lib/server/neon/schema';
import {
	buildCoachPracticeHref,
	type CoachPracticeQuestionOutput
} from '$lib/super/coach-practice-question';

const MAX_EXCLUDED_QUESTION_IDS = 50;

async function getRecentQuestionIds(
	userId: string,
	apClass: string,
	mode: 'mcq' | 'frq'
): Promise<string[]> {
	const db = getNeonDatabase();
	if (mode === 'frq') {
		const rows = await db
			.select({ questionId: frqAttempts.questionId })
			.from(frqAttempts)
			.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.apClass, apClass)))
			.orderBy(desc(frqAttempts.createdAt), desc(frqAttempts.id))
			.limit(MAX_EXCLUDED_QUESTION_IDS);
		return [...new Set(rows.map((row) => row.questionId))];
	}

	const rows = await db
		.select({ questionId: mcqAttempts.questionId })
		.from(mcqAttempts)
		.where(and(eq(mcqAttempts.userId, userId), eq(mcqAttempts.apClass, apClass)))
		.orderBy(desc(mcqAttempts.attemptedAt), desc(mcqAttempts.id))
		.limit(MAX_EXCLUDED_QUESTION_IDS);
	return [...new Set(rows.map((row) => row.questionId))];
}

function mcqCoachOutput(input: {
	questionId: string;
	apClass: string;
	unit: string;
	prompt: string;
	optionA: string;
	optionB: string;
	optionC: string;
	optionD: string;
	topicsCovered?: string;
	hasDiagram?: boolean;
	diagramSpec?: Record<string, unknown> | null;
}): CoachPracticeQuestionOutput {
	return {
		kind: 'practice_question',
		mode: 'mcq',
		questionId: input.questionId,
		apClass: input.apClass,
		unit: input.unit,
		practiceHref: buildCoachPracticeHref({
			apClass: input.apClass,
			unit: input.unit,
			mode: 'mcq',
			questionId: input.questionId
		}),
		topic: input.topicsCovered?.trim() || undefined,
		prompt: input.prompt,
		options: [
			{ id: 'A', label: 'A', text: input.optionA },
			{ id: 'B', label: 'B', text: input.optionB },
			{ id: 'C', label: 'C', text: input.optionC },
			{ id: 'D', label: 'D', text: input.optionD }
		],
		hasDiagram: input.hasDiagram,
		diagramSpec: input.diagramSpec ?? undefined
	};
}

export async function giveCoachPracticeQuestion(
	userId: string,
	input: {
		apClass: string;
		unit?: string;
		mode?: 'mcq' | 'frq';
	}
): Promise<CoachPracticeQuestionOutput | { error: string; retryAfterSeconds?: number }> {
	const mode = input.mode ?? 'mcq';
	const apClass = input.apClass.trim();
	const unit = input.unit?.trim() ?? '';
	const excludeQuestionIds = await getRecentQuestionIds(userId, apClass, mode);

	if (mode === 'frq') {
		if (!getFrqCourseProfile(apClass)) {
			return { error: 'Written-response practice is not available for this course.' };
		}
		const outcome = await frqBank.get(apClass, unit, { excludeQuestionIds });
		if (outcome.status === 'warming') {
			return {
				error: 'Written-response practice is warming up. Please try again shortly.',
				retryAfterSeconds: outcome.retryAfterSeconds
			};
		}
		if (outcome.status !== 'found') {
			return { error: 'Could not load a written-response question right now.' };
		}

		const { publicQuestion, questionId } = outcome.result;
		return {
			kind: 'practice_question',
			mode: 'frq',
			questionId,
			apClass: publicQuestion.apClass,
			unit: publicQuestion.unit,
			practiceHref: buildCoachPracticeHref({
				apClass: publicQuestion.apClass,
				unit: publicQuestion.unit,
				mode: 'frq',
				questionId
			}),
			topic: publicQuestion.topicsCovered,
			prompt: publicQuestion.prompt,
			sections: publicQuestion.sections.map((section) => ({
				label: section.label,
				prompt: section.prompt
			})),
			materials: publicQuestion.materials.map((material) => ({
				title: material.title,
				content: material.content
			}))
		};
	}

	const outcome = await mcqBank.get(apClass, unit, { excludeQuestionIds });
	if (outcome.status === 'warming') {
		return {
			error: 'Question pool is warming up. Please try again shortly.',
			retryAfterSeconds: outcome.retryAfterSeconds
		};
	}
	if (outcome.status !== 'found') {
		return { error: 'Could not load a practice question right now.' };
	}

	const { answer, questionId, apClass: resolvedClass, unit: resolvedUnit } = outcome.result;
	return mcqCoachOutput({
		questionId,
		apClass: resolvedClass,
		unit: resolvedUnit || unit || 'All Units',
		prompt: answer.question,
		optionA: answer.optionA,
		optionB: answer.optionB,
		optionC: answer.optionC,
		optionD: answer.optionD,
		topicsCovered: answer.topicsCovered,
		hasDiagram: answer.hasDiagram,
		diagramSpec: answer.diagramSpec
	});
}
