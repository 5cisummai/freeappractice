import { createHash, randomUUID } from 'node:crypto';
import { tool } from 'ai';
import Parallel from 'parallel-web';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import { COACH_MODEL } from '$lib/ai/ai-models-config';
import { getApCurriculumKnowledge, listApCurriculumCourseNames } from '$lib/ap-knowledge/catalog';
import { claimIdempotencyKey, releaseIdempotencyKey } from '$lib/super/ai-controls.server';
import type { SuperToolsInput } from '$lib/super/agent-request';
import { authorizeFeatureRequest } from '$lib/super/feature-access.server';
import {
	getCoachActivitySummary,
	getCoachFrqPerformance,
	getCoachUnitDetail
} from '$lib/super/coach-reads.server';
import { getCurrentSuperQuestion } from '$lib/super/context.server';
import { renderDiagram } from '$lib/super/diagram-renderer.server';
import { getTutorProfileView, updateTutorProfile } from '$lib/super/profile.server';
import { getCurrentStudyPlan, saveStudyPlan } from '$lib/super/study-plan.server';
import type { StudyTask } from '$lib/super/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { coachAudits } from '$lib/server/neon/schema';
import { getUserProgress } from '$lib/users/model.server';
import { getQuizAttemptForCoach } from '$lib/users/quiz-history.server';

const targetDateSchema = z.object({
	apClass: z.string().trim().min(1).max(100).describe('Exact app-facing AP course name.'),
	targetDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.describe('Target exam date in YYYY-MM-DD format.')
});

const studyTaskSchema = z.object({
	id: z.string().trim().min(1).max(200).describe('Stable unique ID for this task within the plan.'),
	apClass: z.string().trim().min(1).max(100).describe('Exact app-facing AP course name.'),
	unit: z.string().trim().min(1).max(200).describe('Full unit title for this course.'),
	mode: z.enum(['mcq', 'frq', 'review']).describe('Kind of study activity.'),
	date: z.iso.datetime().describe('Scheduled date and time as an ISO 8601 timestamp.'),
	durationMinutes: z.number().int().min(5).max(30).describe('Time allotted, from 5 to 30 minutes.'),
	status: z.enum(['todo', 'done']).default('todo').describe('Use todo for a new task.'),
	practiceHref: z
		.string()
		.startsWith('/app/practice')
		.max(500)
		.optional()
		.describe('Optional in-app practice link; omit if no valid practice URL is known.')
});

const diagramObjectSchema = z.object({
	shape: z.enum(['block', 'circle']).describe('Object shape for a physics diagram.'),
	label: z.string().trim().max(80).optional().describe('Short visible object label.')
});

const forceDirectionSchema = z
	.union([
		z.enum(['up', 'down', 'left', 'right', 'normal', 'up-slope']),
		z.object({ angle: z.number().min(-360).max(360).describe('Direction angle in degrees.') })
	])
	.describe('Named direction or an angle in degrees.');

const forceSchema = z.object({
	direction: forceDirectionSchema,
	label: z.string().trim().min(1).max(80).describe('Short force label, such as weight or normal.'),
	magnitude: z
		.number()
		.min(0)
		.max(1_000_000)
		.optional()
		.describe('Optional nonnegative magnitude.'),
	unit: z.string().trim().max(40).optional().describe('Optional magnitude unit, such as N.'),
	kind: z
		.enum(['gravity', 'normal', 'friction', 'tension', 'spring', 'applied', 'drag', 'buoyant'])
		.optional()
		.describe('Optional semantic force category.')
});

const diagramSpecSchema = z
	.looseObject({
		type: z
			.string()
			.trim()
			.min(1)
			.max(80)
			.describe('Supported examfig diagram type, such as free-body or function-graph.'),
		accessibleDescription: z
			.string()
			.trim()
			.min(1)
			.max(2_000)
			.describe('Plain-language description for screen readers.'),
		title: z.string().trim().max(200).optional().describe('Optional short diagram title.'),
		width: z
			.number()
			.int()
			.min(1)
			.max(4_000)
			.optional()
			.describe('Optional rendered width in pixels.'),
		height: z
			.number()
			.int()
			.min(1)
			.max(4_000)
			.optional()
			.describe('Optional rendered height in pixels.'),
		theme: z.literal('monochrome').optional().describe('Optional monochrome theme.'),
		object: diagramObjectSchema
			.optional()
			.describe('Object shown in a physics diagram, when required by type.'),
		forces: z
			.array(forceSchema)
			.min(1)
			.max(12)
			.optional()
			.describe('Forces for a free-body or similar physics diagram.'),
		angle: z
			.number()
			.min(-360)
			.max(360)
			.optional()
			.describe('Angle in degrees for diagram types that require one.')
	})
	.describe(
		'Semantic examfig DiagramSpec. Add only fields required by the chosen type; never pass SVG or layout coordinates.'
	);

const apClassSchema = z
	.enum(listApCurriculumCourseNames() as [string, ...string[]])
	.describe('Exact app-facing AP course name from the allowed values.');

const webSearchSchema = z.object({
	objective: z
		.string()
		.trim()
		.min(1)
		.max(1000)
		.describe('Specific public fact to verify; exclude private student information.'),
	search_queries: z
		.array(z.string().trim().min(1).max(200))
		.min(1)
		.max(3)
		.describe('One to three distinct focused keyword queries; prefer official source names.')
});

let parallelClient: Parallel | undefined;

function getParallelClient(): Parallel {
	const apiKey = env.PARALLEL_API_KEY?.trim();
	if (!apiKey) throw new Error('PARALLEL_API_KEY is not configured');
	parallelClient ??= new Parallel({ apiKey, timeout: 15_000, maxRetries: 0 });
	return parallelClient;
}

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

function canonicalize(input: unknown): unknown {
	if (Array.isArray(input)) return input.map(canonicalize);
	if (input && typeof input === 'object') {
		return Object.fromEntries(
			Object.entries(input)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, value]) => [key, canonicalize(value)])
		);
	}
	return input;
}

function coachOperationId(sessionId: string, toolName: string, input: unknown): string {
	const fingerprint = createHash('sha256')
		.update(JSON.stringify(canonicalize(input)))
		.digest('base64url');
	return `coach:${sessionId}:${toolName}:${fingerprint}`;
}

async function coachWriteDenied(locals: App.Locals, userId: string): Promise<string | null> {
	const access = await authorizeFeatureRequest({ locals }, userId, 'coach');
	return access.allowed ? null : access.message;
}

export function createSuperTools(input: SuperToolsInput) {
	const { locals, userId, sessionId, currentContext, conversationId, chargeWebSearch } = input;

	return {
		...(env.PARALLEL_API_KEY?.trim()
			? {
					search_web: tool({
						description:
							'Search public web sources when the user needs current or externally verifiable facts. Prefer official sources and cite the returned URLs. Do not search for information already returned in this turn. Never include student names, grades, or private account details.',
						inputSchema: webSearchSchema,
						execute: async ({ objective, search_queries }, { abortSignal }) => {
							try {
								const response = await getParallelClient().search(
									{
										objective,
										search_queries,
										mode: 'fast',
										client_model: COACH_MODEL,
										max_chars_total: 6_000,
										advanced_settings: {
											max_results: 5,
											excerpt_settings: { max_chars_per_result: 1200 }
										}
									},
									{ signal: abortSignal }
								);
								if (!(await chargeWebSearch())) {
									return { error: 'Web search requires three remaining messages this month.' };
								}
								return {
									results: response.results.map((result) => ({
										title: result.title ?? result.url,
										url: result.url,
										publishDate: result.publish_date ?? null,
										excerpts: result.excerpts
									})),
									warnings: response.warnings?.map((warning) => warning.message) ?? []
								};
							} catch {
								return { error: 'Parallel web search is temporarily unavailable.' };
							}
						}
					})
				}
			: {}),
		read_current_question: tool({
			description:
				'Load the canonical on-screen MCQ or FRQ. Use only when context lacks the current question. Do not use in Coach chat without an attached question.',
			inputSchema: z.object({}).describe('No arguments; uses the attached question context.'),
			execute: async () =>
				(await getCurrentSuperQuestion(userId, currentContext)) ?? {
					error: 'No current question is attached to this conversation.'
				}
		}),
		read_course_catalog: tool({
			description:
				'Get the curated AP course and unit titles. Omit apClass to list supported courses; pass apClass without unit to get all its units; pass both to resolve one unit title. A course overview already includes every unit, so do not call once per unit. This catalog is not live exam policy; use official web sources for current rules and detailed topics.',
			inputSchema: z.object({
				apClass: apClassSchema
					.optional()
					.describe(
						'Omit only to list supported courses; otherwise use the exact app-facing name.'
					),
				unit: z
					.string()
					.trim()
					.min(1)
					.max(200)
					.optional()
					.describe('Specific unit only. Omit for the full course; do not pass "all".')
			}),
			execute: async ({ apClass, unit }) =>
				getApCurriculumKnowledge({
					apClass,
					unit: unit?.toLowerCase() === 'all' ? undefined : unit
				})
		}),
		read_profile: tool({
			description:
				'Read the student’s selected courses, target exam dates, and study availability. Use for planning or scheduling; this does not contain mastery or mistakes.',
			inputSchema: z.object({}).describe('No arguments; reads the current student profile.'),
			execute: () => getTutorProfileView(userId)
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
			execute: () => getCurrentStudyPlan(userId)
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
				apClass: z.string().trim().min(1).max(100).describe('Exact app-facing AP course name.'),
				unit: z
					.string()
					.trim()
					.min(1)
					.max(200)
					.describe(
						'Exact full unit title from the catalog or student progress; do not use only "Unit 1".'
					)
			}),
			execute: ({ apClass, unit }) => getCoachUnitDetail(userId, apClass, unit)
		}),
		read_frq_performance: tool({
			description:
				'Read recent graded FRQ attempts with scores and feedback for each part. Use for FRQ writing questions, not MCQ mistakes. Omit filters for recent attempts across courses.',
			inputSchema: z.object({
				apClass: z
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
		}),
		generate_diagram: tool({
			description:
				'Generate an educational diagram that renders inline in the chat. Use this when a visual would clarify the explanation. Pass an examfig semantic DiagramSpec in spec, never SVG or pixel coordinates. Always include accessibleDescription. Supported types include free-body, inclined-plane, mechanics-scene, vector-scene, energy-chart, motion-map, circuit, wave-diagram, ray-diagram, function-graph, unit-circle, data-plot, process-diagram, and other registered examfig science/math types. For AP Physics, prefer free-body, inclined-plane, mechanics-scene, energy-chart, motion-map, or vector-scene.',
			inputSchema: z.object({
				spec: diagramSpecSchema.describe(
					'Complete semantic examfig specification for the requested visual.'
				)
			}),
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
				'Propose changes to selected AP classes, target exam dates, or study availability only when the student requests them. Requires student approval before writing; do not use for mastery, grades, or billing.',
			inputSchema: z.object({
				selectedApClasses: z
					.array(z.string().trim().min(1).max(100))
					.max(20)
					.optional()
					.describe('Replacement list of selected AP courses; omit to leave courses unchanged.'),
				targetDates: z
					.array(targetDateSchema)
					.max(20)
					.optional()
					.describe('Replacement exam target dates; omit to leave dates unchanged.'),
				studyAvailability: z
					.string()
					.trim()
					.max(500)
					.optional()
					.describe('New free-text weekly availability; omit to leave it unchanged.')
			}),
			needsApproval: true,
			execute: async (patch) => {
				const denied = await coachWriteDenied(locals, userId);
				if (denied) return { updated: false, error: denied };
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
				'Propose a new or updated weekly study plan only when the student asks to save or change it. Each task lasts 5 to 30 minutes. Requires student approval before writing; use read_study_plan first when modifying an existing plan and preserve completed tasks.',
			inputSchema: z.object({
				startsOn: z.iso
					.datetime()
					.describe('Start date for the weekly plan as an ISO 8601 timestamp.'),
				behavior: z
					.enum(['replace', 'merge'])
					.default('replace')
					.describe(
						'Defaults to replace, which swaps the plan; merge adds or updates tasks while preserving others.'
					),
				tasks: z
					.array(studyTaskSchema)
					.max(28)
					.describe('Up to 28 scheduled study tasks for the plan.')
			}),
			needsApproval: true,
			execute: async ({ startsOn, behavior, tasks }) => {
				const denied = await coachWriteDenied(locals, userId);
				if (denied) return { updated: false, error: denied };
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
								error: 'Completed study tasks cannot be changed or rescheduled by Pip.'
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
