import { createHash, randomUUID } from 'node:crypto';
import { tool } from 'ai';

import { z } from 'zod';
import { COACH_MODEL } from '$lib/agent/model';
import { getCourseNames } from '$lib/catalog/courses';
import { claimIdempotencyKey, releaseIdempotencyKey } from '$lib/agent/usage/controls.server';
import type { AgentToolsInput } from '$lib/agent/request';
import { authorizeFeatureRequest } from '$lib/agent/access.server';

import { studyPlanToolInputSchema } from '$lib/agent/plans/tool-schema';

import { getTutorProfileView, updateTutorProfile } from '$lib/agent/personalization/profile.server';
import {
	addStudyPlanDays,
	getCurrentStudyPlan,
	saveStudyPlan
} from '$lib/agent/plans/store.server';
import { StudyPlanConflictError, StudyPlansLockedError } from '$lib/agent/plans/store.server';
import type { StudyPlanView, StudyTask } from '$lib/agent/plans/types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { coachAudits } from '$lib/server/neon/schema';
import { logger } from '$lib/server/logger';

const targetDateSchema = z.object({
	course: z.string().trim().min(1).max(100).describe('Exact app-facing AP course name.'),
	targetDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.describe('Target exam date in YYYY-MM-DD format.')
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

function studyPlanToolView(plan: StudyPlanView | null): StudyPlanView | null {
	return plan
		? {
				...plan,
				startsOn: plan.startsOn.slice(0, 10),
				tasks: plan.tasks.map((task) => ({ ...task, date: task.date.slice(0, 10) }))
			}
		: null;
}

export function createWriteTools(input: AgentToolsInput) {
	const { locals, userId, sessionId, conversationId } = input;
	return {
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
					locals.tutorProfileView = Promise.resolve(after);
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
				'Propose a new or updated weekly study plan only when the student asks to save or change it. Use weekStart as the first local calendar date of the plan in YYYY-MM-DD form, then schedule each task with dayOffset 0 through 6. Do not provide timestamps or a time zone. Use the listed AP course labels. Each task lasts 5 to 30 minutes. Requires student approval before writing; use read_study_plan first when modifying an existing plan and preserve completed tasks. If the result has updated=false, report the returned error and do not claim the plan was saved.',
			inputSchema: studyPlanToolInputSchema,
			strict: true,
			needsApproval: true,
			execute: async ({ weekStart, behavior, tasks }) => {
				const denied = await coachWriteDenied(locals, userId);
				if (denied) return { updated: false, error: denied };
				const datedTasks: StudyTask[] = [];
				for (const { dayOffset, course, practiceHref, ...task } of tasks) {
					if (!getCourseNames().includes(course)) {
						return { updated: false, error: `Unsupported AP course: ${course}` };
					}
					datedTasks.push({
						...task,
						course,
						...(practiceHref ? { practiceHref } : {}),
						date: addStudyPlanDays(weekStart, dayOffset),
						status: 'todo'
					});
				}
				const operationInput = { weekStart, behavior, tasks: datedTasks };
				const operationId = coachOperationId(sessionId, 'update_study_plan', operationInput);
				if (!(await claimIdempotencyKey(userId, operationId))) {
					return { updated: true, alreadyApplied: true };
				}
				let existingPlan: StudyPlanView | null;
				let after: StudyPlanView;
				let before: Record<string, unknown>;
				try {
					existingPlan = await getCurrentStudyPlan(userId);
					before = existingPlan ?? {};
					if (behavior === 'replace' && existingPlan) {
						const proposedById = new Map(datedTasks.map((task) => [task.id, task]));
						const modifiesCompletedTask = existingPlan.tasks.some((task) => {
							if (task.status !== 'done') return false;
							const proposed = proposedById.get(task.id);
							return (
								!proposed ||
								proposed.course !== task.course ||
								proposed.unit !== task.unit ||
								proposed.mode !== task.mode ||
								proposed.date.slice(0, 10) !== task.date.slice(0, 10) ||
								proposed.durationMinutes !== task.durationMinutes ||
								(proposed.practiceHref ?? '') !== (task.practiceHref ?? '')
							);
						});
						if (modifiesCompletedTask) {
							await releaseIdempotencyKey(userId, operationId);
							return {
								updated: false,
								error: 'Completed study tasks cannot be changed or rescheduled by Pip.'
							};
						}
					}
					after = await saveStudyPlan(
						userId,
						{ startsOn: weekStart, tasks: datedTasks },
						{ behavior }
					);
				} catch (error) {
					await releaseIdempotencyKey(userId, operationId);
					logger.error('Study plan tool save failed', { userId, sessionId, error });
					return {
						updated: false,
						error:
							error instanceof StudyPlanConflictError
								? 'The study plan changed while saving. Refresh the plan and try again.'
								: error instanceof StudyPlansLockedError
									? 'Study plan access is unavailable for this account.'
									: 'The save could not be confirmed. Check the Plan page before trying again.'
					};
				}
				try {
					await writeAudit(userId, sessionId, 'update_study_plan', before, after, conversationId);
				} catch (error) {
					logger.error('Study plan saved but audit write failed', { userId, sessionId, error });
				}
				return { updated: true, studyPlan: studyPlanToolView(after) };
			}
		})
	};
}
