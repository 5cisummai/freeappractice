import { tool } from 'ai';

import { z } from 'zod';

import { getCatalogFacts } from '#lib/catalog/sources.js';

import type { AgentToolsInput } from '#lib/agent/request.js';

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

export function createReadTools(input: AgentToolsInput) {
	const { userId, currentContext, locals } = input;
	return {
		read_current_question: tool({
			description:
				'Load the canonical on-screen MCQ or FRQ. Use only when context lacks the current question. Do not use in Coach chat without an attached question.',
			inputSchema: z.object({}).describe('No arguments; uses the attached question context.'),
			execute: async () =>
				(await getCurrentQuestion(userId, currentContext)) ?? {
					error: 'No current question is attached to this conversation.'
				}
		}),
		read_course_catalog: tool({
			description:
				'Get the curated AP course and unit titles. Omit course to list supported courses; pass course without unit to get all its units; pass both to resolve one unit title. A course overview already includes every unit, so do not call once per unit. This catalog is not live exam policy; use official web sources for current rules and detailed topics.',
			inputSchema: z.object({
				course: courseSchema
					.optional()
					.describe(
						'Omit only to list supported courses; otherwise use a canonical app label or supported official alias.'
					),
				unit: z
					.string()
					.trim()
					.min(1)
					.max(200)
					.optional()
					.describe('Specific unit only. Omit for the full course; do not pass "all".')
			}),
			execute: async ({ course, unit }) =>
				getCatalogFacts({
					course,
					unit: unit?.toLowerCase() === 'all' ? undefined : unit
				})
		}),
		read_profile: tool({
			description:
				'Read the student’s selected courses, target exam dates, and study availability. Use for planning or scheduling; this does not contain mastery or mistakes.',
			inputSchema: z.object({}).describe('No arguments; reads the current student profile.'),
			execute: () => getTutorProfileViewForRequest(locals, userId)
		}),
		read_progress_summary: tool({
			description:
				'Read up to six weakest tracked units across all courses, requiring at least three MCQ attempts per unit. Use for overall weakness; use read_unit_detail for a named unit. An empty weakestUnits list means no units meet the attempt threshold.',
			inputSchema: z.object({}).describe('No arguments; summarizes progress across courses.'),
			execute: async () => {
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
			}
		}),
		read_quiz_attempt: tool({
			description:
				'Read one completed quiz owned by this student. Use for an explicit review of that quiz, not general progress. By default returns up to 20 incorrect questions; pass questionPositions to inspect specific questions.',
			inputSchema: z.object({
				quizId: z.uuid().describe('UUID of the completed quiz being reviewed.'),
				questionPositions: z
					.array(z.number().int().min(1).max(50))
					.max(20)
					.optional()
					.describe(
						'Optional one-based question numbers, 1 to 50; omit to review incorrect questions.'
					)
			}),
			execute: async ({ quizId, questionPositions }) =>
				(await getQuizAttemptForCoach(userId, quizId, questionPositions)) ?? {
					error: 'Quiz not found or unavailable.'
				}
		}),
		read_study_plan: tool({
			description:
				'Read the active weekly study plan and each task’s status. Use for planning, scheduling, or what-to-study-next questions. A null result means there is no active plan; do not repeat the read.',
			inputSchema: z.object({}).describe('No arguments; reads the current student study plan.'),
			execute: async () => studyPlanToolView(await getCurrentStudyPlan(userId))
		}),
		read_activity_summary: tool({
			description:
				'Read study habits: streak, lifetime practice totals and time, last-seven-day MCQ/FRQ activity, and top subjects. Use for activity patterns, not unit mastery or mistakes.',
			inputSchema: z
				.object({})
				.describe('No arguments; reads the current student activity summary.'),
			execute: () => getCoachActivitySummary(userId)
		}),
		read_unit_detail: tool({
			description:
				'Read MCQ mastery and up to five recent mistakes for one exact course/unit pair. Use for a named unit instead of read_progress_summary. If progress is null, there is no exact matching tracked progress; do not retry with abbreviated unit names.',
			inputSchema: z.object({
				course: z.string().trim().min(1).max(100).describe('Exact app-facing AP course name.'),
				unit: z
					.string()
					.trim()
					.min(1)
					.max(200)
					.describe(
						'Exact full unit title from the catalog or student progress; do not use only "Unit 1".'
					)
			}),
			execute: ({ course, unit }) => getCoachUnitDetail(userId, course, unit)
		}),
		read_frq_performance: tool({
			description:
				'Read recent graded FRQ attempts with scores and feedback for each part. Use for FRQ writing questions, not MCQ mistakes. Omit filters for recent attempts across courses.',
			inputSchema: z.object({
				course: z
					.string()
					.trim()
					.min(1)
					.max(100)
					.optional()
					.describe('Optional exact AP course name.'),
				unit: z
					.string()
					.trim()
					.min(1)
					.max(200)
					.optional()
					.describe('Optional exact full unit title.'),
				limit: z
					.number()
					.int()
					.min(1)
					.max(6)
					.optional()
					.describe('Maximum attempts to return; defaults to 5, maximum 6.')
			}),
			execute: (filter) => getCoachFrqPerformance(userId, filter)
		})
	};
}
