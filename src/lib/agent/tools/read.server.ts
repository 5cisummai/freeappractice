import { z } from 'zod';

import { getCatalogFacts } from '#lib/catalog/sources.js';

import type { AgentContext } from '#lib/agent/request.js';

import {
	getCoachActivitySummary,
	getCoachFrqPerformance,
	getCoachUnitDetail
} from '#lib/agent/tools/evidence.server.js';

import { getCurrentQuestion } from '#lib/agent/personalization/context.server.js';
import { courseSchema } from '#lib/agent/plans/tool-schema.js';

import { getTutorProfileViewForRequest } from '#lib/agent/access.server.js';
import { getCurrentStudyPlan } from '#lib/agent/plans/store.server.js';

import type { StudyPlanView } from '#lib/agent/plans/types.js';

import { getUserProgress } from '#lib/users/model.server.js';
import { getQuizAttemptForCoach } from '#lib/users/quiz-history.server.js';

function studyPlanToolView(plan: StudyPlanView | null): StudyPlanView | null {
	return plan
		? {
				...plan,
				startsOn: plan.startsOn.slice(0, 10),
				tasks: plan.tasks.map((task) => ({ ...task, date: task.date.slice(0, 10) }))
			}
		: null;
}

function readTool<T extends z.ZodType>(schema: T, run: (input: z.output<T>) => unknown) {
	return async (input: unknown) => {
		const parsed = schema.safeParse(input);
		return parsed.success
			? { ok: true as const, output: await run(parsed.data) }
			: { ok: false as const };
	};
}

export function createReadTools(input: {
	userId: string;
	currentContext: AgentContext;
	locals: App.Locals;
}) {
	const { userId, currentContext, locals } = input;
	return {
		read_current_question: readTool(
			z.object({}),
			async () =>
				(await getCurrentQuestion(userId, currentContext)) ?? {
					error: 'No current question is attached to this conversation.'
				}
		),
		read_course_catalog: readTool(
			z.object({
				course: courseSchema.optional(),
				unit: z.string().trim().min(1).max(200).optional()
			}),
			async ({ course, unit }) =>
				getCatalogFacts({
					course,
					unit: unit?.toLowerCase() === 'all' ? undefined : unit
				})
		),
		read_profile: readTool(z.object({}), () => getTutorProfileViewForRequest(locals, userId)),
		read_progress_summary: readTool(z.object({}), async () => {
			const progress = await getUserProgress(userId);
			const weakestUnits = progress
				.filter((item) => item.totalAttempts >= 3)
				.sort((a, b) => a.mastery - b.mastery || b.totalAttempts - a.totalAttempts)
				.slice(0, 6)
				.map((item) => ({
					course: item.course,
					unit: item.unit,
					mastery: item.mastery,
					totalAttempts: item.totalAttempts,
					correctAttempts: item.correctAttempts,
					lastAttemptAt: item.lastAttemptAt?.toISOString() ?? null
				}));
			return { trackedUnitCount: progress.length, weakestUnits };
		}),
		read_quiz_attempt: readTool(
			z.object({
				quizId: z.uuid(),
				questionPositions: z.array(z.number().int().min(1).max(50)).max(20).optional()
			}),
			async ({ quizId, questionPositions }) =>
				(await getQuizAttemptForCoach(userId, quizId, questionPositions)) ?? {
					error: 'Quiz not found or unavailable.'
				}
		),
		read_study_plan: readTool(z.object({}), async () =>
			studyPlanToolView(await getCurrentStudyPlan(userId))
		),
		read_activity_summary: readTool(z.object({}), () => getCoachActivitySummary(userId)),
		read_unit_detail: readTool(
			z.object({
				course: z.string().trim().min(1).max(100),
				unit: z.string().trim().min(1).max(200)
			}),
			({ course, unit }) => getCoachUnitDetail(userId, course, unit)
		),
		read_frq_performance: readTool(
			z.object({
				course: z.string().trim().min(1).max(100).optional(),
				unit: z.string().trim().min(1).max(200).optional(),
				limit: z.number().int().min(1).max(6).optional()
			}),
			(filter) => getCoachFrqPerformance(userId, filter)
		)
	};
}
