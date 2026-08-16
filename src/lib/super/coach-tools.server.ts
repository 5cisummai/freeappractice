import { createHash, randomUUID } from 'node:crypto';
import { tool } from 'ai';
import { z } from 'zod';
import { COACH_MODEL } from '$lib/ai/ai-models-config';
import { getApCurriculumKnowledge } from '$lib/ap-knowledge/catalog';
import {
	claimIdempotencyKey,
	hasCoachWriteAuthorization,
	releaseIdempotencyKey,
	type CoachWriteCategory
} from '$lib/super/ai-controls.server';
import type { SuperToolsInput } from '$lib/super/coach-agent.types';
import {
	getCoachActivitySummary,
	getCoachFrqPerformance,
	getCoachUnitDetail
} from '$lib/super/coach-reads.server';
import { coachPracticeQuestionToolOutputSchema } from '$lib/super/coach-practice-question';
import { getCurrentSuperQuestion } from '$lib/super/context.server';
import { renderDiagram } from '$lib/super/diagram-renderer.server';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import { getCurrentStoredInsightReport } from '$lib/super/insights.server';
import { getTutorProfileView, updateTutorProfile } from '$lib/super/profile.server';
import { getCurrentStudyPlan, saveStudyPlan } from '$lib/super/study-plan.server';
import type { StudyTask } from '$lib/super/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { coachAudits } from '$lib/server/neon/schema';
import { getUserProgress } from '$lib/users/model.server';
import { getQuizAttemptForCoach } from '$lib/users/quiz-history.server';

const targetDateSchema = z.object({
	apClass: z.string().trim().min(1).max(100),
	targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const studyTaskSchema = z.object({
	id: z.string().trim().min(1).max(200),
	apClass: z.string().trim().min(1).max(100),
	unit: z.string().trim().min(1).max(200),
	mode: z.enum(['mcq', 'frq', 'review']),
	date: z.string().datetime(),
	durationMinutes: z.number().int().min(5).max(30),
	status: z.enum(['todo', 'done']).default('todo'),
	practiceHref: z.string().startsWith('/app/practice').max(500).optional()
});

const diagramObjectSchema = z.object({
	shape: z.enum(['block', 'circle']),
	label: z.string().trim().max(80).optional()
});

const forceDirectionSchema = z.union([
	z.enum(['up', 'down', 'left', 'right', 'normal', 'up-slope']),
	z.object({ angle: z.number().min(-360).max(360) })
]);

const forceSchema = z.object({
	direction: forceDirectionSchema,
	label: z.string().trim().min(1).max(80),
	magnitude: z.number().min(0).max(1_000_000).optional(),
	unit: z.string().trim().max(40).optional(),
	kind: z
		.enum(['gravity', 'normal', 'friction', 'tension', 'spring', 'applied', 'drag', 'buoyant'])
		.optional()
});

const diagramSpecSchema = z.looseObject({
	type: z.string().trim().min(1).max(80),
	accessibleDescription: z.string().trim().min(1).max(2_000),
	title: z.string().trim().max(200).optional(),
	width: z.number().int().min(1).max(4_000).optional(),
	height: z.number().int().min(1).max(4_000).optional(),
	theme: z.literal('monochrome').optional(),
	object: diagramObjectSchema.optional(),
	forces: z.array(forceSchema).min(1).max(12).optional(),
	angle: z.number().min(-360).max(360).optional()
});

async function writeAudit(
	userId: string,
	sessionId: string,
	toolName: string,
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	conversationId?: string
): Promise<void> {
	await getNeonDatabase()
		.insert(coachAudits)
		.values({
			id: randomUUID(),
			userId,
			sessionId,
			toolName,
			before,
			after,
			modelId: COACH_MODEL,
			...(conversationId ? { conversationId } : {})
		});
}

async function authorized(
	locals: App.Locals,
	userId: string,
	sessionId: string,
	category: CoachWriteCategory
): Promise<boolean> {
	const access = await authorizeFeatureRequest({ locals }, userId, 'coach');
	if (!access.allowed) return false;
	return hasCoachWriteAuthorization(userId, sessionId, category);
}

function coachOperationId(sessionId: string, toolName: string, input: unknown): string {
	const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('base64url');
	return `coach:${sessionId}:${toolName}:${fingerprint}`;
}

export function createSuperTools(input: SuperToolsInput) {
	const { locals, userId, sessionId, currentContext, conversationId } = input;

	return {
		read_current_question: tool({
			description:
				'Load the canonical on-screen MCQ or FRQ. Use only when context lacks the current question. Do not use in Coach chat without an attached question.',
			inputSchema: z.object({}),
			execute: async () =>
				(await getCurrentSuperQuestion(userId, currentContext)) ?? {
					error: 'No current question is attached to this conversation.'
				}
		}),
		read_course_catalog: tool({
			description:
				'Official AP unit map and freshness limits. Use for curriculum framing before unit advice. Omit args only to list supported courses. Treat the freshness note as a hard limit—never present the catalog as live exam policy. Unit coverage is title-only; do not invent detailed topics beyond the unit label.',
			inputSchema: z.object({
				apClass: z.string().trim().min(1).max(100).optional(),
				unit: z.string().trim().min(1).max(200).optional()
			}),
			execute: async (request) => getApCurriculumKnowledge(request)
		}),
		read_profile: tool({
			description:
				'Goals only: selected courses, target exam dates, study availability. Do not use for mastery or mistakes.',
			inputSchema: z.object({}),
			execute: () => getTutorProfileView(userId)
		}),
		read_progress_summary: tool({
			description:
				'Weakest units across all courses (up to 6 by mastery). Use for "where am I weak overall". Do not use when a specific unit is named—use read_unit_detail instead.',
			inputSchema: z.object({}),
			execute: async () => {
				const progress = await getUserProgress(userId);
				const weakestUnits = progress
					.filter((item) => item.totalAttempts >= 3)
					.sort((a, b) => a.mastery - b.mastery || b.totalAttempts - a.totalAttempts)
					.slice(0, 6)
					.map((item) => ({
						apClass: item.apClass,
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
				'One completed graded quiz by Quiz ID. Use only for explicit quiz review requests.',
			inputSchema: z.object({
				quizId: z.string().uuid(),
				questionPositions: z.array(z.number().int().min(1).max(50)).max(20).optional()
			}),
			execute: async ({ quizId, questionPositions }) =>
				(await getQuizAttemptForCoach(userId, quizId, questionPositions)) ?? {
					error: 'Quiz not found or unavailable.'
				}
		}),
		read_insights: tool({
			description:
				'Cross-course strengths, weaknesses, and actionable insights (top 5 each). Use for overall patterns. Skip if read_unit_detail already returned insights for that unit.',
			inputSchema: z.object({}),
			execute: async () => {
				const report = await getCurrentStoredInsightReport(userId);
				return report
					? {
							generatedAt: report.generatedAt,
							evidenceAttemptCount: report.evidenceAttemptCount,
							eligibility: report.report.eligibility,
							strengths: report.report.strengths.slice(0, 5),
							weaknesses: report.report.weaknesses.slice(0, 5),
							actionableInsights: report.report.actionableInsights.slice(0, 5)
						}
					: null;
			}
		}),
		read_study_plan: tool({
			description:
				'Active weekly study plan and task statuses. Use for planning or schedule questions.',
			inputSchema: z.object({}),
			execute: () => getCurrentStudyPlan(userId)
		}),
		read_activity_summary: tool({
			description:
				'Habits only: streak, last-7-day MCQ/FRQ volume and accuracy, time on task, top subjects. Do not use for unit mastery or mistakes.',
			inputSchema: z.object({}),
			execute: () => getCoachActivitySummary(userId)
		}),
		read_unit_detail: tool({
			description:
				'Single-unit snapshot: MCQ mastery, recent mistakes with explanations, and stored insights. Preferred read for any named unit. Do not also call read_progress_summary or read_insights for the same unit.',
			inputSchema: z.object({
				apClass: z.string().trim().min(1).max(100),
				unit: z.string().trim().min(1).max(200)
			}),
			execute: ({ apClass, unit }) => getCoachUnitDetail(userId, apClass, unit)
		}),
		read_frq_performance: tool({
			description:
				'Recent graded FRQ attempts with criterion feedback. Use only for FRQ writing questions—not for MCQ mistakes.',
			inputSchema: z.object({
				apClass: z.string().trim().min(1).max(100).optional(),
				unit: z.string().trim().min(1).max(200).optional(),
				limit: z.number().int().min(1).max(6).optional()
			}),
			execute: (filter) => getCoachFrqPerformance(userId, filter)
		}),
		give_practice_question: tool({
			description:
				'Get one bank question and show it inline for the student to answer or skip. The tool pauses until they respond, then returns their result in the output: MCQ selected letter and correctness, or FRQ score and feedback. Use when the student wants a problem to try. Never reveal the correct answer in your reply.',
			inputSchema: z.object({
				apClass: z.string().trim().min(1).max(100),
				unit: z.string().trim().min(1).max(200).optional(),
				mode: z.enum(['mcq', 'frq']).default('mcq')
			}),
			outputSchema: coachPracticeQuestionToolOutputSchema
		}),
		generate_diagram: tool({
			description:
				'Generate an educational diagram that renders inline in the chat. Use this when a visual would clarify the explanation. Pass an examfig semantic DiagramSpec in spec, never SVG or pixel coordinates. Always include accessibleDescription. Supported types include free-body, inclined-plane, mechanics-scene, vector-scene, energy-chart, motion-map, circuit, wave-diagram, ray-diagram, function-graph, unit-circle, data-plot, process-diagram, and other registered examfig science/math types. For AP Physics, prefer free-body, inclined-plane, mechanics-scene, energy-chart, motion-map, or vector-scene.',
			inputSchema: z.object({ spec: diagramSpecSchema }),
			execute: async ({ spec }) => {
				try {
					return renderDiagram(spec);
				} catch (error) {
					return {
						error:
							error instanceof Error
								? `The diagram could not be rendered: ${error.message}`
								: 'The diagram could not be rendered.'
					};
				}
			}
		}),
		update_goals: tool({
			description:
				'After explicit student approval, update selected AP classes, target dates, and study availability only. State the proposed change before calling.',
			inputSchema: z.object({
				selectedApClasses: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
				targetDates: z.array(targetDateSchema).max(20).optional(),
				studyAvailability: z.string().trim().max(500).optional()
			}),
			execute: async (patch) => {
				if (!(await authorized(locals, userId, sessionId, 'goals'))) {
					return { updated: false, approvalRequired: true, category: 'goals', proposed: patch };
				}
				const operationId = coachOperationId(sessionId, 'update_goals', patch);
				if (!(await claimIdempotencyKey(userId, operationId))) {
					return { updated: true, alreadyApplied: true };
				}
				try {
					const before = await getTutorProfileView(userId);
					const after = await updateTutorProfile(userId, patch);
					await writeAudit(userId, sessionId, 'update_goals', before, after, conversationId);
					return { updated: true, profile: after };
				} catch (error) {
					await releaseIdempotencyKey(userId, operationId);
					throw error;
				}
			}
		}),
		update_study_plan: tool({
			description:
				'After explicit student approval, replace or merge the active study plan with tasks of at most 30 minutes. State the proposed change before calling.',
			inputSchema: z.object({
				startsOn: z.string().datetime(),
				behavior: z.enum(['replace', 'merge']).default('replace'),
				tasks: z.array(studyTaskSchema).max(28)
			}),
			execute: async ({ startsOn, behavior, tasks }) => {
				if (!(await authorized(locals, userId, sessionId, 'study_plans'))) {
					return {
						updated: false,
						approvalRequired: true,
						category: 'study_plans',
						proposed: { startsOn, behavior, tasks }
					};
				}
				const operationInput = { startsOn, behavior, tasks };
				const operationId = coachOperationId(sessionId, 'update_study_plan', operationInput);
				if (!(await claimIdempotencyKey(userId, operationId))) {
					return { updated: true, alreadyApplied: true };
				}
				try {
					const existingPlan = await getCurrentStudyPlan(userId);
					const before = existingPlan ?? {};
					if (behavior === 'replace' && existingPlan) {
						const proposedById = new Map(tasks.map((task) => [task.id, task]));
						const modifiesCompletedTask = existingPlan.tasks.some((task) => {
							if (task.status !== 'done') return false;
							const proposed = proposedById.get(task.id);
							return !proposed || JSON.stringify(proposed) !== JSON.stringify(task);
						});
						if (modifiesCompletedTask) {
							await releaseIdempotencyKey(userId, operationId);
							return {
								updated: false,
								error: 'Completed study tasks cannot be changed or rescheduled by Coach.'
							};
						}
					}
					const after = await saveStudyPlan(
						userId,
						{ startsOn, tasks: tasks as StudyTask[] },
						{ behavior }
					);
					await writeAudit(userId, sessionId, 'update_study_plan', before, after, conversationId);
					return { updated: true, studyPlan: after };
				} catch (error) {
					await releaseIdempotencyKey(userId, operationId);
					throw error;
				}
			}
		})
	};
}
