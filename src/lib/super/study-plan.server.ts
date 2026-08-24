import { randomUUID } from 'node:crypto';
import { and, asc, eq, exists, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { studyPlans, studyTasks } from '$lib/server/neon/schema';
import { getPlanAccess } from '$lib/super/billing.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import {
	hasPaidCapability,
	type StudyPlanInsights,
	type StudyPlanView,
	type StudyTask
} from '$lib/super/types';
import { isDuplicateKeyError } from '$lib/question-bank/util.server';

export const STUDY_PLAN_RETENTION_DAYS = 90;
export const STUDY_PLAN_MAX_TASK_MINUTES = 30;

export type StudyPlanDraft = {
	startsOn: string | Date;
	tasks: StudyTask[];
	insights?: StudyPlanInsights | null;
};

export class StudyPlansLockedError extends Error {
	constructor(message = 'Study plans are unavailable without active access') {
		super(message);
		this.name = 'StudyPlansLockedError';
	}
}

export class StudyPlanConflictError extends Error {
	constructor(message = 'Study plan changed while saving; please retry.') {
		super(message);
		this.name = 'StudyPlanConflictError';
	}
}

function asDate(value: Date | string): Date {
	const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
	if (!Number.isFinite(date.getTime())) throw new Error('Study plan date is invalid');
	return date;
}

function startOfUtcDay(value: Date | string): Date {
	const date = asDate(value);
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function requireStudyPlanAccess(userId: string, now = new Date()): Promise<void> {
	const planAccess = await getPlanAccess(userId, now);
	if (!hasPaidCapability(planAccess, 'studyPlans')) throw new StudyPlansLockedError();
	if (!(await getTutorProfileView(userId)).ageConfirmedAt) throw new StudyPlansLockedError();
}

function isoDate(value: Date | string | undefined): string {
	const date = value ? asDate(value) : null;
	if (!date) throw new Error('Study plan has invalid timestamp');
	return date.toISOString();
}

/** Convert a stored plan to a Date-free, JSON-safe view. */
export function toStudyPlanView(plan: {
	id: unknown;
	userId: string;
	startsOn: Date | string;
	tasks: Array<{
		id: string;
		apClass: string;
		unit: string;
		mode: 'mcq' | 'frq' | 'review';
		date: Date | string;
		durationMinutes: number;
		status: 'todo' | 'done';
		practiceHref?: string;
	}>;
	insights?: StudyPlanInsights | null;
	updatedAt: Date | string;
}): StudyPlanView {
	return {
		id: String(plan.id),
		startsOn: isoDate(plan.startsOn),
		tasks: plan.tasks.map((task) => ({
			id: task.id,
			apClass: task.apClass,
			unit: task.unit,
			mode: task.mode,
			date: isoDate(task.date),
			durationMinutes: Math.min(STUDY_PLAN_MAX_TASK_MINUTES, task.durationMinutes),
			status: task.status,
			...(task.practiceHref ? { practiceHref: task.practiceHref } : {})
		})),
		...(plan.insights ? { insights: plan.insights } : {}),
		updatedAt: isoDate(plan.updatedAt)
	};
}

function mergeTasks(existing: StudyTask[], incoming: StudyTask[]): StudyTask[] {
	const byId = new Map(existing.map((task) => [task.id, task]));
	for (const task of incoming) {
		const previous = byId.get(task.id);
		byId.set(task.id, {
			...task,
			durationMinutes: Math.min(STUDY_PLAN_MAX_TASK_MINUTES, task.durationMinutes),
			status: previous?.status === 'done' ? 'done' : task.status
		});
	}
	return [...byId.values()];
}

function cappedTasks(tasks: StudyTask[]): StudyTask[] {
	const seen = new Set<string>();
	return tasks
		.filter((task) => {
			if (seen.has(task.id)) return false;
			seen.add(task.id);
			return true;
		})
		.map((task) => ({
			...task,
			durationMinutes: Math.max(
				5,
				Math.min(STUDY_PLAN_MAX_TASK_MINUTES, Math.round(task.durationMinutes))
			)
		}));
}

type StoredPlanTask = StudyTask & { date: Date };
type StoredPlan = {
	id: string;
	userId: string;
	startsOn: Date;
	tasks: StoredPlanTask[];
	insights: StudyPlanInsights | null;
	updatedAt: Date;
};

type StoredPlanWriteOptions = {
	existing?: StoredPlan | null;
	expectedUpdatedAt?: Date | null;
};

async function readStoredPlan(userId: string): Promise<StoredPlan | null> {
	const db = getNeonDatabase() as any;
	const plan = (
		await db
			.select()
			.from(studyPlans as any)
			.where(eq((studyPlans as any).userId, userId))
			.limit(1)
	)[0] as Record<string, any> | undefined;
	if (!plan) return null;
	const tasks = await db
		.select()
		.from(studyTasks as any)
		.where(eq((studyTasks as any).planId, plan.id))
		.orderBy(asc((studyTasks as any).taskDate));
	return {
		id: plan.id,
		userId: plan.userId,
		startsOn: plan.startsOn,
		updatedAt: plan.updatedAt,
		insights: (plan.insights as StudyPlanInsights | null | undefined) ?? null,
		tasks: (tasks as Array<Record<string, any>>).map((task) => ({
			id: task.id,
			apClass: task.apClass,
			unit: task.unit,
			mode: task.mode,
			date: task.taskDate,
			durationMinutes: task.durationMinutes,
			status: task.status,
			practiceHref: task.practiceHref ?? undefined
		}))
	};
}

async function writeStoredPlan(
	userId: string,
	startsOn: Date,
	tasks: StudyTask[],
	options: StoredPlanWriteOptions = {},
	insights?: StudyPlanInsights | null
): Promise<StoredPlan> {
	const db = getNeonDatabase() as any;
	const existing = options.existing === undefined ? await readStoredPlan(userId) : options.existing;
	const expectedUpdatedAt =
		options.expectedUpdatedAt === undefined
			? (existing?.updatedAt ?? null)
			: options.expectedUpdatedAt;
	const planId = existing?.id ?? randomUUID();
	const updatedAt = new Date(
		Math.max(Date.now(), (expectedUpdatedAt?.getTime() ?? 0) + (existing ? 1 : 0))
	);
	const parentWrite = existing
		? db
				.update(studyPlans as any)
				.set({
					startsOn,
					updatedAt,
					...(insights !== undefined ? { insights } : {})
				})
				.where(
					and(
						eq((studyPlans as any).id, planId),
						eq((studyPlans as any).updatedAt, expectedUpdatedAt)
					)
				)
				.returning({ id: (studyPlans as any).id })
		: db
				.insert(studyPlans as any)
				.values({
					id: planId,
					userId,
					startsOn,
					updatedAt,
					...(insights !== undefined ? { insights } : {})
				})
				.returning({ id: (studyPlans as any).id });

	// The parent CAS version also gates these statements. If the parent update
	// loses, the rest of the batch becomes a no-op before we report a conflict.
	const parentStillHasVersion = exists(
		db
			.select({ id: (studyPlans as any).id })
			.from(studyPlans as any)
			.where(and(eq((studyPlans as any).id, planId), eq((studyPlans as any).updatedAt, updatedAt)))
	);
	const deleteTasks = db
		.delete(studyTasks as any)
		.where(and(eq((studyTasks as any).planId, planId), parentStillHasVersion));
	const statements = [parentWrite, deleteTasks];
	if (tasks.length) {
		const values = sql.join(
			tasks.map(
				(task) =>
					sql`(
						${task.id},
						${planId},
						${task.apClass},
						${task.unit},
						${task.mode},
						${startOfUtcDay(task.date)},
						${task.durationMinutes},
						${task.status},
						${task.practiceHref ?? null}
					)`
			),
			sql`, `
		);
		statements.push(
			db.insert(studyTasks as any).select(sql`
				SELECT incoming.id, incoming.plan_id, incoming.ap_class, incoming.unit,
					incoming.mode, incoming.task_date, incoming.duration_minutes,
					incoming.status, incoming.practice_href
				FROM (VALUES ${values}) AS incoming(
					id, plan_id, ap_class, unit, mode, task_date,
					duration_minutes, status, practice_href
				)
				WHERE EXISTS (
					SELECT 1 FROM ${studyPlans as any}
					WHERE ${(studyPlans as any).id} = ${planId}
						AND ${(studyPlans as any).updatedAt} = ${updatedAt}
				)
			`)
		);
	}

	const [parentResult] = await db.batch(statements);
	if (existing && (!parentResult || parentResult.length === 0)) {
		throw new StudyPlanConflictError();
	}
	const saved = await readStoredPlan(userId);
	if (!saved) throw new Error('Study plan could not be saved');
	return saved;
}

/** Replace or merge through the unique userId key, preserving completion for matching task IDs. */
export async function saveStudyPlan(
	userId: string,
	draft: StudyPlanDraft,
	options: { behavior?: 'replace' | 'merge' } = {}
): Promise<StudyPlanView> {
	await requireStudyPlanAccess(userId);
	const startsOn = startOfUtcDay(draft.startsOn);
	const tasks = cappedTasks(draft.tasks);

	if (options.behavior === 'merge') {
		// Optimistic matching prevents a concurrent completion/reschedule from being lost.
		// A retry reads the latest task state before merging again.
		for (let attempt = 0; attempt < 3; attempt++) {
			const existing = await readStoredPlan(userId);
			try {
				if (!existing) {
					return toStudyPlanView(
						await writeStoredPlan(
							userId,
							startsOn,
							tasks,
							{
								existing: null,
								expectedUpdatedAt: null
							},
							draft.insights
						)
					);
				}
				const nextTasks = mergeTasks(existing.tasks as StudyTask[], tasks);
				return toStudyPlanView(
					await writeStoredPlan(
						userId,
						startsOn,
						nextTasks,
						{
							existing,
							expectedUpdatedAt: existing.updatedAt
						},
						draft.insights
					)
				);
			} catch (error) {
				if (isDuplicateKeyError(error) || error instanceof StudyPlanConflictError) continue;
				throw error;
			}
		}
		throw new StudyPlanConflictError('Study plan changed while merging; please retry.');
	}

	const existing = await readStoredPlan(userId);
	return toStudyPlanView(
		await writeStoredPlan(
			userId,
			startsOn,
			tasks,
			{
				existing,
				expectedUpdatedAt: existing?.updatedAt ?? null
			},
			draft.insights
		)
	);
}

/** Returns the one stored plan only while the study-plan entitlement is valid. */
export async function getCurrentStudyPlan(
	userId: string,
	now = new Date()
): Promise<StudyPlanView | null> {
	try {
		await requireStudyPlanAccess(userId, now);
	} catch (error) {
		if (error instanceof StudyPlansLockedError) return null;
		throw error;
	}
	const plan = await readStoredPlan(userId);
	return plan ? toStudyPlanView(plan) : null;
}

export async function deleteStudyPlan(userId: string): Promise<void> {
	await requireStudyPlanAccess(userId);
	const db = getNeonDatabase() as any;
	await db.delete(studyPlans as any).where(eq((studyPlans as any).userId, userId));
}

async function updateTask(
	userId: string,
	taskId: string,
	update: Record<string, unknown>
): Promise<StudyPlanView | null> {
	await requireStudyPlanAccess(userId);
	const plan = await readStoredPlan(userId);
	if (!plan) return null;
	const task = plan.tasks.find((item) => item.id === taskId);
	if (!task) return null;
	Object.assign(task, update);
	const saved = await writeStoredPlan(userId, plan.startsOn, plan.tasks, {
		existing: plan,
		expectedUpdatedAt: plan.updatedAt
	});
	return toStudyPlanView(saved);
}

export async function setStudyTaskStatus(
	userId: string,
	taskId: string,
	status: 'todo' | 'done'
): Promise<StudyPlanView | null> {
	return updateTask(userId, taskId, { status });
}

export async function completeStudyTask(
	userId: string,
	taskId: string
): Promise<StudyPlanView | null> {
	return setStudyTaskStatus(userId, taskId, 'done');
}

export async function rescheduleStudyTask(
	userId: string,
	taskId: string,
	date: Date | string
): Promise<StudyPlanView | null> {
	return updateTask(userId, taskId, { date: startOfUtcDay(date) });
}
