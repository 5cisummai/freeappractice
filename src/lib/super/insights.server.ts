import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { structuredObject } from '$lib/ai/service.server';
import { COACH_MODEL } from '$lib/ai/ai-models-config';
import { getNeonDatabase } from '$lib/server/neon/db';
import {
	frqAttemptGrades,
	frqAttempts,
	mcqAttempts,
	tutorProfiles,
	userProfiles
} from '$lib/server/neon/schema';
import { logger } from '$lib/server/logger';
import { isSuperCoachEnabled } from '$lib/flags';
import { getPlanAccess } from '$lib/super/billing.server';
import { getTutorProfileView } from '$lib/super/profile.server';
import {
	getCurrentStudyPlan,
	saveStudyPlan,
	StudyPlanConflictError,
	StudyPlansLockedError
} from '$lib/super/study-plan.server';
import { getCoachActivitySummary } from '$lib/super/coach-reads.server';
import { getRecentSuperMistakes } from '$lib/super/context.server';
import { getUserProgress } from '$lib/users/model.server';
import {
	hasPaidCapability,
	type StudyPlanInsights,
	type StudyPlanView,
	type StudyTask
} from '$lib/super/types';

const INSIGHTS_WINDOW_DAYS = 7;
const COMPARISON_WINDOW_DAYS = 35;
const DAY_MS = 24 * 60 * 60 * 1000;

const insightOutputSchema = z.object({
	headline: z.string().trim().min(1).max(160),
	summary: z.string().trim().min(1).max(600),
	focusAreas: z
		.array(
			z.object({
				kind: z.enum(['focus', 'momentum', 'habit']),
				title: z.string().trim().min(1).max(120),
				detail: z.string().trim().min(1).max(300),
				why: z.string().trim().min(1).max(240),
				apClass: z.string().trim().max(100).nullable(),
				unit: z.string().trim().max(200).nullable()
			})
		)
		.min(1)
		.max(3),
	planRationale: z.string().trim().min(1).max(300),
	tasks: z
		.array(
			z.object({
				apClass: z.string().trim().min(1).max(100),
				unit: z.string().trim().min(1).max(200),
				mode: z.enum(['mcq', 'frq', 'review']),
				date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				durationMinutes: z.number().int().min(5).max(30)
			})
		)
		.max(14)
});

type InsightOutput = z.infer<typeof insightOutputSchema>;

export type InsightsResponse = StudyPlanInsights & {
	plan: StudyPlanView | null;
	skipped?: boolean;
};

export function isInsightsRefreshDue(generatedAt: string | undefined, now: Date): boolean {
	if (!generatedAt) return true;
	const generated = new Date(generatedAt).getTime();
	if (!Number.isFinite(generated)) return true;
	return now.getTime() - generated >= INSIGHTS_WINDOW_DAYS * DAY_MS;
}

async function requireInsightsGenerationAccess(userId: string, now: Date): Promise<void> {
	if (!(await isSuperCoachEnabled())) {
		throw new StudyPlansLockedError('Coach is temporarily unavailable.');
	}
	const access = await getPlanAccess(userId, now);
	if (!hasPaidCapability(access, 'studyPlans') || !hasPaidCapability(access, 'coach')) {
		throw new StudyPlansLockedError();
	}
	if (!(await getTutorProfileView(userId)).ageConfirmedAt) throw new StudyPlansLockedError();
}

type McqRow = {
	apClass: string;
	unit: string;
	wasCorrect: boolean | null;
	attemptedAt: Date;
};

type UnitWindow = {
	apClass: string;
	unit: string;
	recentAttempts: number;
	recentCorrect: number;
	previousAttempts: number;
	previousCorrect: number;
};

function startOfUtcDay(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dayKey(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function percentage(correct: number, total: number): number | null {
	return total ? Math.round((correct / total) * 100) : null;
}

function addDays(value: Date, days: number): Date {
	return new Date(value.getTime() + days * DAY_MS);
}

function clampTaskDate(value: string, startsOn: Date): Date {
	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (!Number.isFinite(parsed.getTime())) return startsOn;
	const endsOn = addDays(startsOn, INSIGHTS_WINDOW_DAYS - 1);
	return new Date(Math.min(Math.max(parsed.getTime(), startsOn.getTime()), endsOn.getTime()));
}

function taskKey(task: Pick<StudyTask, 'apClass' | 'unit' | 'mode' | 'date'>): string {
	return `${task.apClass}:${task.unit}:${task.mode}:${dayKey(new Date(task.date))}`;
}

function practiceHref(apClass: string, unit: string, mode: StudyTask['mode']): string {
	const query = new URLSearchParams({ apClass, unit });
	if (mode === 'frq') query.set('mode', 'frq');
	return `/app/practice?${query.toString()}`;
}

function aggregateUnits(rows: McqRow[], recentCutoff: Date): UnitWindow[] {
	const units = new Map<string, UnitWindow>();
	for (const row of rows) {
		if (row.wasCorrect === null) continue;
		const key = `${row.apClass}:${row.unit}`;
		const current = units.get(key) ?? {
			apClass: row.apClass,
			unit: row.unit,
			recentAttempts: 0,
			recentCorrect: 0,
			previousAttempts: 0,
			previousCorrect: 0
		};
		if (row.attemptedAt >= recentCutoff) {
			current.recentAttempts += 1;
			if (row.wasCorrect) current.recentCorrect += 1;
		} else {
			current.previousAttempts += 1;
			if (row.wasCorrect) current.previousCorrect += 1;
		}
		units.set(key, current);
	}
	return [...units.values()].sort(
		(a, b) => b.recentAttempts + b.previousAttempts - (a.recentAttempts + a.previousAttempts)
	);
}

function buildPlanTasks(
	output: InsightOutput,
	currentPlan: StudyPlanView | null,
	startsOn: Date,
	allowedUnits: Set<string>
): StudyTask[] {
	const existingByKey = new Map((currentPlan?.tasks ?? []).map((task) => [taskKey(task), task]));
	const proposed: StudyTask[] = [];

	for (const [index, task] of output.tasks.entries()) {
		if (!allowedUnits.has(`${task.apClass}:${task.unit}`)) continue;
		const date = clampTaskDate(task.date, startsOn);
		const nextTask: StudyTask = {
			id: `insights-${dayKey(date)}-${index + 1}-${randomUUID().slice(0, 8)}`,
			apClass: task.apClass,
			unit: task.unit,
			mode: task.mode,
			date: date.toISOString(),
			durationMinutes: task.durationMinutes,
			status: 'todo',
			practiceHref: practiceHref(task.apClass, task.unit, task.mode)
		};
		const existing = existingByKey.get(taskKey(nextTask));
		if (existing?.status === 'done') nextTask.id = existing.id;
		nextTask.status = existing?.status === 'done' ? 'done' : 'todo';
		proposed.push(nextTask);
	}

	const proposedKeys = new Set(proposed.map(taskKey));
	const completedFromPrevious = (currentPlan?.tasks ?? []).filter(
		(task) => task.status === 'done' && !proposedKeys.has(taskKey(task))
	);
	return [...proposed, ...completedFromPrevious].slice(0, 28);
}

function sanitizeFocusAreas(
	focusAreas: InsightOutput['focusAreas'],
	allowedUnits: Set<string>
): InsightOutput['focusAreas'] {
	return focusAreas.map((area) => {
		if (
			(area.apClass === null && area.unit === null) ||
			(area.apClass && area.unit && allowedUnits.has(`${area.apClass}:${area.unit}`))
		) {
			return area;
		}
		return { ...area, apClass: null, unit: null };
	});
}

async function readInsightsContext(userId: string, now: Date) {
	const db = getNeonDatabase();
	const recentCutoff = new Date(now.getTime() - INSIGHTS_WINDOW_DAYS * DAY_MS);
	const comparisonCutoff = new Date(now.getTime() - COMPARISON_WINDOW_DAYS * DAY_MS);
	const [mcqRows, frqRows, activity, progress, mistakes, profile, currentPlan] = await Promise.all([
		db
			.select({
				apClass: mcqAttempts.apClass,
				unit: mcqAttempts.unit,
				wasCorrect: mcqAttempts.wasCorrect,
				attemptedAt: mcqAttempts.attemptedAt
			})
			.from(mcqAttempts)
			.where(and(eq(mcqAttempts.userId, userId), gte(mcqAttempts.attemptedAt, comparisonCutoff)))
			.orderBy(desc(mcqAttempts.attemptedAt))
			.limit(500),
		db
			.select({
				apClass: frqAttempts.apClass,
				unit: frqAttempts.unit,
				percentage: frqAttemptGrades.percentage,
				createdAt: frqAttempts.createdAt
			})
			.from(frqAttempts)
			.innerJoin(frqAttemptGrades, eq(frqAttemptGrades.attemptId, frqAttempts.id))
			.where(
				and(
					eq(frqAttempts.userId, userId),
					eq(frqAttempts.status, 'graded'),
					gte(frqAttempts.createdAt, comparisonCutoff)
				)
			)
			.orderBy(desc(frqAttempts.createdAt))
			.limit(100),
		getCoachActivitySummary(userId),
		getUserProgress(userId),
		getRecentSuperMistakes(userId),
		getTutorProfileView(userId),
		getCurrentStudyPlan(userId)
	]);

	const recentMcq = mcqRows.filter(
		(row) => row.attemptedAt >= recentCutoff && row.wasCorrect !== null
	);
	const previousMcq = mcqRows.filter(
		(row) => row.attemptedAt < recentCutoff && row.wasCorrect !== null
	);
	const recentFrq = frqRows.filter((row) => row.createdAt >= recentCutoff);
	const activeDays = new Set([
		...recentMcq.map((row) => dayKey(row.attemptedAt)),
		...recentFrq.map((row) => dayKey(row.createdAt))
	]).size;
	const recentCorrect = recentMcq.filter((row) => row.wasCorrect).length;
	const previousCorrect = previousMcq.filter((row) => row.wasCorrect).length;
	const recentFrqPercentage = recentFrq.length
		? Math.round(recentFrq.reduce((sum, row) => sum + Number(row.percentage), 0) / recentFrq.length)
		: null;
	const unitWindows = aggregateUnits(mcqRows, recentCutoff);
	const allowedUnits = new Set([
		...progress.map((row) => `${row.apClass}:${row.unit}`),
		...unitWindows.map((row) => `${row.apClass}:${row.unit}`)
	]);

	return {
		profile: {
			selectedApClasses: profile.selectedApClasses,
			targetDates: profile.targetDates,
			studyAvailability: profile.studyAvailability
		},
		window: {
			startsOn: recentCutoff.toISOString(),
			endsOn: now.toISOString(),
			days: INSIGHTS_WINDOW_DAYS
		},
		metrics: {
			mcqAttempts: recentMcq.length,
			mcqAccuracy: percentage(recentCorrect, recentMcq.length),
			frqSubmissions: recentFrq.length,
			frqAveragePercentage: recentFrqPercentage,
			activeDays,
			previousMcqAttempts: previousMcq.length,
			previousMcqAccuracy: percentage(previousCorrect, previousMcq.length)
		} satisfies StudyPlanInsights['metrics'],
		activity: {
			currentStreak: activity.currentStreak,
			lifetime: activity.lifetime,
			subjectBreakdown: activity.subjectBreakdown
		},
		unitWindows: unitWindows.slice(0, 20).map((unit) => ({
			...unit,
			recentAccuracy: percentage(unit.recentCorrect, unit.recentAttempts),
			previousAccuracy: percentage(unit.previousCorrect, unit.previousAttempts)
		})),
		mastery: progress
			.filter((row) => row.totalAttempts >= 3)
			.sort((a, b) => a.mastery - b.mastery || b.totalAttempts - a.totalAttempts)
			.slice(0, 8)
			.map((row) => ({
				apClass: row.apClass,
				unit: row.unit,
				mastery: row.mastery,
				totalAttempts: row.totalAttempts
			})),
		recentMistakes: mistakes
			.filter((mistake) => new Date(mistake.attemptedAt) >= recentCutoff)
			.slice(0, 8)
			.map((mistake) => ({
				apClass: mistake.apClass,
				unit: mistake.unit,
				topic: mistake.topic,
				attemptedAt: mistake.attemptedAt,
				explanation: mistake.explanation
			})),
		currentPlan,
		allowedUnits: [...allowedUnits]
	};
}

export async function generateInsights(
	userId: string,
	now = new Date(),
	options: { force?: boolean } = {}
): Promise<InsightsResponse> {
	await requireInsightsGenerationAccess(userId, now);
	const existingPlan = await getCurrentStudyPlan(userId, now);
	if (
		!options.force &&
		existingPlan?.insights &&
		!isInsightsRefreshDue(existingPlan.insights.generatedAt, now)
	) {
		return {
			...existingPlan.insights,
			plan: existingPlan,
			skipped: true
		};
	}

	const context = await readInsightsContext(userId, now);
	const { parsed } = await structuredObject<InsightOutput>({
		callName: 'super_insights',
		model: COACH_MODEL,
		schema: insightOutputSchema,
		schemaName: 'super_insights',
		reasoningEffort: 'medium',
		logContext: { userId, windowDays: INSIGHTS_WINDOW_DAYS },
		system: [
			'You are Super Insights, the evidence-based planning layer for an AP practice app.',
			'Progress already shows raw charts and statistics. Your job is to explain what changed, why it matters, and what the student should do next.',
			'Use only the server-owned context supplied by the user message. Never invent scores, attempts, units, mistakes, dates, or trends.',
			'Use the recent seven-day window as the main signal, and use the comparison and mastery data to avoid overreacting to a small sample.',
			'If there is little or no activity, say that the evidence is thin and recommend a small baseline-building plan instead of claiming a weakness.',
			'Focus areas should be concrete and limited to three. Prefer exact AP course and unit names from allowedUnits.',
			'For a focus area without a specific course and unit, return null for both apClass and unit.',
			'Every plan task must use an exact allowedUnits course/unit pair, take 5–30 minutes, and fall within the next seven calendar days.',
			'Keep the writing warm, direct, and specific. Do not predict an AP score or make claims about exam policy.'
		].join('\n'),
		user: `Current date: ${now.toISOString()}\n\nServer-owned student context:\n${JSON.stringify(context)}`
	});

	const startsOn = startOfUtcDay(now);
	const insights = {
		generatedAt: now.toISOString(),
		window: context.window,
		metrics: context.metrics,
		headline: parsed.headline,
		summary: parsed.summary,
		focusAreas: sanitizeFocusAreas(parsed.focusAreas, new Set(context.allowedUnits)),
		planRationale: parsed.planRationale
	} satisfies StudyPlanInsights;

	for (let attempt = 0; attempt < 3; attempt++) {
		const currentPlan = await getCurrentStudyPlan(userId, now);
		const tasks = buildPlanTasks(parsed, currentPlan, startsOn, new Set(context.allowedUnits));
		try {
			const plan = await saveStudyPlan(
				userId,
				{
					startsOn: startsOn.toISOString(),
					tasks: tasks.length ? tasks : (currentPlan?.tasks ?? []),
					insights
				},
				{ behavior: 'replace' }
			);
			return { ...insights, plan };
		} catch (error) {
			if (error instanceof StudyPlanConflictError) continue;
			throw error;
		}
	}
	throw new StudyPlanConflictError('Study plan changed while saving insights; please retry.');
}

export type WeeklyInsightsSummary = {
	candidates: number;
	generated: number;
	skipped: number;
	failed: number;
};

/** Generate the next weekly plan for every eligible Super account. */
export async function runWeeklyInsights(now = new Date()): Promise<WeeklyInsightsSummary> {
	if (!(await isSuperCoachEnabled())) {
		return { candidates: 0, generated: 0, skipped: 0, failed: 0 };
	}

	const db = getNeonDatabase();
	const profiles = await db
		.select({
			userId: tutorProfiles.userId,
			assistantFeaturesEnabled: userProfiles.assistantFeaturesEnabled
		})
		.from(tutorProfiles)
		.leftJoin(userProfiles, eq(userProfiles.userId, tutorProfiles.userId))
		.where(and(isNotNull(tutorProfiles.ageConfirmedAt), isNull(tutorProfiles.superEndedAt)));

	let generated = 0;
	let skipped = 0;
	let failed = 0;
	const eligibleUserIds: string[] = [];
	for (const profile of profiles) {
		if (profile.assistantFeaturesEnabled === false) {
			skipped += 1;
			continue;
		}
		const access = await getPlanAccess(profile.userId, now);
		if (!hasPaidCapability(access, 'coach') || !hasPaidCapability(access, 'studyPlans')) {
			skipped += 1;
			continue;
		}
		eligibleUserIds.push(profile.userId);
	}

	for (let index = 0; index < eligibleUserIds.length; index += 4) {
		const batch = eligibleUserIds.slice(index, index + 4);
		const results = await Promise.all(
			batch.map(async (userId) => {
				try {
					const result = await generateInsights(userId, now);
					return result.skipped ? ('skipped' as const) : ('generated' as const);
				} catch (error) {
					logger.error('Weekly insights generation failed', { userId, error });
					return 'failed' as const;
				}
			})
		);
		generated += results.filter((result) => result === 'generated').length;
		skipped += results.filter((result) => result === 'skipped').length;
		failed += results.filter((result) => result === 'failed').length;
	}

	return { candidates: profiles.length, generated, skipped, failed };
}
