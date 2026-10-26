import { and, desc, eq } from 'drizzle-orm';
import {
	getAllowedCourses,
	getUnitsForCourse,
	resolveEffectiveUnit
} from '#lib/catalog/courses.js';
import { getFrqCourseProfile } from '#lib/question-bank/frq/profiles.server.js';
import { resolveFrqPoolRequest } from '#lib/question-bank/frq/practice.js';
import { mcqBank } from '#lib/question-bank/mcq/bank.server.js';
import { frqBank } from '#lib/question-bank/frq/bank.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { frqAttempts, mcqAttempts } from '#lib/server/neon/schema.js';
import {
	buildCoachPracticeHref,
	type CoachPracticeQuestionOutput,
	type CoachPracticeQuestionToolInput
} from '#lib/agent/tools/practice.js';

const UNIT_TITLE_PREFIX = /^(?:Unit|Big Idea) \d+:\s+/;
const ALL_UNITS_LABEL = 'All Units';

export function resolveCoachPracticeQuestionCatalog(
	input: CoachPracticeQuestionToolInput
): { ok: true; course: string; unit: string; mode: 'mcq' | 'frq' } | { ok: false; error: string } {
	const course = input.course.trim();
	const mode = input.mode ?? 'mcq';
	if (!getAllowedCourses().has(course)) {
		return {
			ok: false,
			error: `"${course}" is not a supported AP course. Use the exact catalog course name.`
		};
	}

	const units = getUnitsForCourse(course);
	const requested = input.unit?.trim() ?? '';
	if (!requested || requested === ALL_UNITS_LABEL) {
		const unit = resolveEffectiveUnit(course, '');
		if (!unit) {
			return { ok: false, error: `No units are available for ${course}.` };
		}
		return { ok: true, course, unit, mode };
	}

	if (units.includes(requested)) {
		return { ok: true, course, unit: requested, mode };
	}

	const mapped = units.filter((label) => label.replace(UNIT_TITLE_PREFIX, '') === requested);
	if (mapped.length === 1) {
		return { ok: true, course, unit: mapped[0]!, mode };
	}

	return {
		ok: false,
		error: `"${requested}" is not a unit in ${course}. Use the full catalog title, including the "Unit N:" prefix.`
	};
}

const MAX_EXCLUDED_QUESTION_IDS = 50;

async function getRecentQuestionIds(
	userId: string,
	course: string,
	mode: 'mcq' | 'frq'
): Promise<string[]> {
	const db = getNeonDatabase();
	if (mode === 'frq') {
		const rows = await db
			.select({ questionId: frqAttempts.questionId })
			.from(frqAttempts)
			.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.course, course)))
			.orderBy(desc(frqAttempts.createdAt), desc(frqAttempts.id))
			.limit(MAX_EXCLUDED_QUESTION_IDS);
		return [...new Set(rows.map((row) => row.questionId))];
	}

	const rows = await db
		.select({ questionId: mcqAttempts.questionId })
		.from(mcqAttempts)
		.where(and(eq(mcqAttempts.userId, userId), eq(mcqAttempts.course, course)))
		.orderBy(desc(mcqAttempts.attemptedAt), desc(mcqAttempts.id))
		.limit(MAX_EXCLUDED_QUESTION_IDS);
	return [...new Set(rows.map((row) => row.questionId))];
}

function mcqCoachOutput(input: {
	questionId: string;
	course: string;
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
		course: input.course,
		unit: input.unit,
		practiceHref: buildCoachPracticeHref({
			course: input.course,
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
		course: string;
		unit?: string;
		mode?: 'mcq' | 'frq';
	}
): Promise<CoachPracticeQuestionOutput | { error: string; retryAfterSeconds?: number }> {
	const resolved = resolveCoachPracticeQuestionCatalog({
		course: input.course,
		unit: input.unit,
		mode: input.mode ?? 'mcq'
	});
	if (!resolved.ok) {
		return { error: resolved.error };
	}

	const { course, unit, mode } = resolved;
	const excludeQuestionIds = await getRecentQuestionIds(userId, course, mode);

	if (mode === 'frq') {
		if (!getFrqCourseProfile(course)) {
			return { error: 'Written-response practice is not available for this course.' };
		}
		const poolUnit = resolveFrqPoolRequest(course, unit).poolUnit;
		const outcome = await frqBank.get(course, poolUnit, { excludeQuestionIds, allowRefill: true });
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
			course: publicQuestion.course,
			unit: publicQuestion.unit,
			practiceHref: buildCoachPracticeHref({
				course: publicQuestion.course,
				unit: publicQuestion.unit,
				mode: 'frq',
				questionId
			}),
			topic: publicQuestion.topicsCovered,
			prompt: publicQuestion.prompt,
			sections: publicQuestion.parts.map((part) => ({
				label: part.label,
				prompt: part.prompt
			})),
			materials: publicQuestion.materials.map((material) => ({
				title: material.title,
				content: material.content
			}))
		};
	}

	const outcome = await mcqBank.get(course, unit, { excludeQuestionIds, allowRefill: true });
	if (outcome.status === 'warming') {
		return {
			error: 'Question pool is warming up. Please try again shortly.',
			retryAfterSeconds: outcome.retryAfterSeconds
		};
	}
	if (outcome.status !== 'found') {
		return { error: 'Could not load a practice question right now.' };
	}

	const { answer, questionId, course: resolvedCourse, unit: resolvedUnit } = outcome.result;
	return mcqCoachOutput({
		questionId,
		course: resolvedCourse,
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
