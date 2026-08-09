import { randomUUID } from 'node:crypto';
import { and, asc, eq, exists, sql } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { studyPlans, studyTasks } from '$lib/server/neon/schema';
import { isSuperInsightsEnabled } from '$lib/flags';
import { getEntitlements } from '$lib/super/entitlements.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import {
	getCurrentEligibleInsightReport,
	type InsightClaim,
	type InsightReportData
} from '$lib/super/insights.server';
import type { StudyPlanView, StudyTask } from '$lib/super/types';
import type { Entitlements } from '$lib/super/types';
import { isDuplicateKeyError } from '$lib/questions/util.server';

export const STUDY_PLAN_DAYS = 7;
export const STUDY_PLAN_MAX_TASK_MINUTES = 30;
export const STUDY_PLAN_DEFAULT_TASK_MINUTES = 25;

export type StudyPlanDraft = {
	startsOn: string | Date;
	tasks: StudyTask[];
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

function dateForDay(startsOn: Date, offset: number): string {
	const date = new Date(startsOn.getTime());
	date.setUTCDate(date.getUTCDate() + offset);
	return date.toISOString();
}

function taskHref(claim: InsightClaim): string {
	const params = new URLSearchParams({ apClass: claim.apClass, unit: claim.unit });
	if (claim.source === 'frq') params.set('mode', 'frq');
	return `/app/practice?${params.toString()}`;
}

function comparePlanClaim(a: InsightClaim, b: InsightClaim): number {
	return (
		a.metric.weightedAveragePercentage - b.metric.weightedAveragePercentage ||
		b.metric.count - a.metric.count ||
		a.apClass.localeCompare(b.apClass) ||
		a.unit.localeCompare(b.unit) ||
		a.source.localeCompare(b.source)
	);
}

function reportClaims(report: InsightReportData): InsightClaim[] {
	const claims = [...report.weaknesses];
	if (!claims.length) {
		for (const course of report.courses) {
			for (const unit of course.units) claims.push(...unit.weaknesses, ...unit.strengths);
		}
	}
	return [
		...new Map(
			claims.map((claim) => [`${claim.source}:${claim.apClass}:${claim.unit}`, claim])
		).values()
	].sort(comparePlanClaim);
}

/** Build a deterministic seven-day draft from eligible insight claims. */
export function buildStudyPlanDraft(
	report: InsightReportData,
	options: { startsOn?: Date | string; taskMinutes?: number } = {}
): StudyPlanDraft {
	if (!report.eligibility.eligible) {
		throw new Error('An eligible insight report is required to build a study plan');
	}
	const startsOn = startOfUtcDay(options.startsOn ?? report.calculation.asOf);
	const durationMinutes = Math.max(
		5,
		Math.min(
			STUDY_PLAN_MAX_TASK_MINUTES,
			Math.round(options.taskMinutes ?? STUDY_PLAN_DEFAULT_TASK_MINUTES)
		)
	);
	const claims = reportClaims(report);
	if (!claims.length) return { startsOn: startsOn.toISOString(), tasks: [] };

	const tasks: StudyTask[] = Array.from({ length: STUDY_PLAN_DAYS }, (_, day) => {
		const claim = claims[day % claims.length];
		return {
			id: `super-study-${dateForDay(startsOn, day).slice(0, 10)}-${day + 1}`,
			apClass: claim.apClass,
			unit: claim.unit,
			mode: claim.source,
			date: dateForDay(startsOn, day),
			durationMinutes,
			status: 'todo',
			practiceHref: taskHref(claim)
		};
	});
	return { startsOn: startsOn.toISOString(), tasks };
}

export function hasStudyPlanAccess(entitlements: Pick<Entitlements, 'studyPlans'>): boolean {
	return entitlements.studyPlans;
}

async function requireStudyPlanAccess(userId: string, now = new Date()): Promise<void> {
	if (!(await isSuperInsightsEnabled())) throw new StudyPlansLockedError();
	const entitlements = await getEntitlements(userId, now);
	if (!hasStudyPlanAccess(entitlements)) throw new StudyPlansLockedError();
	if (!(await getTutorProfileView(userId)).ageConfirmedAt) throw new StudyPlansLockedError();
}

function isoDate(value: Date | string | undefined): string {
	const date = value ? asDate(value) : null;
	if (!date) throw new Error('Study plan has invalid timestamp');
	return date.toISOString();
}

/** Convert a stored plan to a Date-free, JSON-safe view. */
export function toStudyPlanView(plan: {
	_id?: unknown;
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
	updatedAt: Date | string;
}): StudyPlanView {
	return {
		id: plan._id === undefined ? '' : String(plan._id),
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
	_id: string;
	userId: string;
	startsOn: Date;
	tasks: StoredPlanTask[];
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
		_id: plan.id,
		userId: plan.userId,
		startsOn: plan.startsOn,
		updatedAt: plan.updatedAt,
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
	options: StoredPlanWriteOptions = {}
): Promise<StoredPlan> {
	const db = getNeonDatabase() as any;
	const existing = options.existing === undefined ? await readStoredPlan(userId) : options.existing;
	const expectedUpdatedAt =
		options.expectedUpdatedAt === undefined
			? (existing?.updatedAt ?? null)
			: options.expectedUpdatedAt;
	const planId = existing?._id ?? randomUUID();
	const updatedAt = new Date(
		Math.max(Date.now(), (expectedUpdatedAt?.getTime() ?? 0) + (existing ? 1 : 0))
	);
	const parentWrite = existing
		? db
				.update(studyPlans as any)
				.set({ startsOn, updatedAt })
				.where(
					and(
						eq((studyPlans as any).id, planId),
						eq((studyPlans as any).updatedAt, expectedUpdatedAt)
					)
				)
				.returning({ id: (studyPlans as any).id })
		: db
				.insert(studyPlans as any)
				.values({ id: planId, userId, startsOn, updatedAt })
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
						await writeStoredPlan(userId, startsOn, tasks, {
							existing: null,
							expectedUpdatedAt: null
						})
					);
				}
				const nextTasks = mergeTasks(existing.tasks as StudyTask[], tasks);
				return toStudyPlanView(
					await writeStoredPlan(userId, startsOn, nextTasks, {
						existing,
						expectedUpdatedAt: existing.updatedAt
					})
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
		await writeStoredPlan(userId, startsOn, tasks, {
			existing,
			expectedUpdatedAt: existing?.updatedAt ?? null
		})
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

/** Build and save a one-week plan from the latest still-eligible report. */
export async function generateStudyPlan(
	userId: string,
	options: { startsOn?: Date | string; behavior?: 'replace' | 'merge'; taskMinutes?: number } = {}
): Promise<StudyPlanView | null> {
	await requireStudyPlanAccess(userId);
	const report = await getCurrentEligibleInsightReport(userId);
	if (!report) return null;
	const draft = buildStudyPlanDraft(report.report, options);
	return saveStudyPlan(userId, draft, { behavior: options.behavior ?? 'replace' });
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
