import { connectDb } from '$lib/server/db';
import { getEntitlements } from '$lib/super/entitlements.server';
import { StudyPlan } from '$lib/super/models.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import {
	getCurrentEligibleInsightReport,
	type InsightClaim,
	type InsightReportData
} from '$lib/super/insights.server';
import type { StudyPlanView, StudyTask } from '$lib/super/types';
import type { Entitlements } from '$lib/super/types';

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

/** Replace or merge through the unique userId key, preserving completion for matching task IDs. */
export async function saveStudyPlan(
	userId: string,
	draft: StudyPlanDraft,
	options: { behavior?: 'replace' | 'merge' } = {}
): Promise<StudyPlanView> {
	await requireStudyPlanAccess(userId);
	const startsOn = startOfUtcDay(draft.startsOn);
	const tasks = cappedTasks(draft.tasks);
	await connectDb();

	if (options.behavior === 'merge') {
		// Optimistic matching prevents a concurrent completion/reschedule from being lost.
		// A retry reads the latest task state before merging again.
		for (let attempt = 0; attempt < 3; attempt++) {
			const existing = await StudyPlan.findOne({ userId }).lean().exec();
			if (!existing) {
				try {
					const inserted = await StudyPlan.findOneAndUpdate(
						{ userId },
						{ $set: { userId, startsOn, tasks } },
						{ upsert: true, new: true, setDefaultsOnInsert: true }
					).exec();
					if (!inserted) throw new Error('Study plan could not be saved');
					return toStudyPlanView(inserted);
				} catch (error) {
					if (
						error instanceof Error &&
						'code' in error &&
						(error as { code?: number }).code === 11000
					) {
						continue;
					}
					throw error;
				}
			}
			const nextTasks = mergeTasks((existing.tasks ?? []) as StudyTask[], tasks);
			const saved = await StudyPlan.findOneAndUpdate(
				{ userId, updatedAt: existing.updatedAt },
				{ $set: { startsOn, tasks: nextTasks } },
				{ new: true }
			).exec();
			if (saved) return toStudyPlanView(saved);
		}
		throw new Error('Study plan changed while merging; please retry');
	}

	const saved = await StudyPlan.findOneAndUpdate(
		{ userId },
		{
			$set: {
				userId,
				startsOn,
				tasks
			}
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	).exec();
	if (!saved) throw new Error('Study plan could not be saved');
	return toStudyPlanView(saved);
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
	await connectDb();
	const plan = await StudyPlan.findOne({ userId }).lean().exec();
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
	await connectDb();
	await StudyPlan.deleteOne({ userId }).exec();
}

async function updateTask(
	userId: string,
	taskId: string,
	update: Record<string, unknown>
): Promise<StudyPlanView | null> {
	await requireStudyPlanAccess(userId);
	await connectDb();
	const plan = await StudyPlan.findOneAndUpdate(
		{ userId, 'tasks.id': taskId },
		{
			$set: Object.fromEntries(
				Object.entries(update).map(([key, value]) => [`tasks.$.${key}`, value])
			)
		},
		{ new: true }
	)
		.lean()
		.exec();
	return plan ? toStudyPlanView(plan) : null;
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

/** Exposed for callers that need to decide whether a stored plan may be shown. */
export async function isStudyPlanReadable(userId: string, now = new Date()): Promise<boolean> {
	const entitlements = await getEntitlements(userId, now);
	return hasStudyPlanAccess(entitlements);
}
