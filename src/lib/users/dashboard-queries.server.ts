import { and, count, eq, isNotNull, max, sql } from 'drizzle-orm';
import { getFrqProgressForUser } from '$lib/grading/frq/attempts.server';
import { frqAttempts, mcqAttempts, mcqQuestions } from '$lib/server/neon/schema';
import { getNeonDatabase } from '$lib/server/neon/db';
import { getCurrentStreak } from '$lib/users/streak.server';
import { questionPayloadTextField } from '$lib/server/neon/jsonb';
import { MAX_ATTEMPT_TIME_MS } from '$lib/users/attempt-time';
import { buildProgressDataFromAttempts, mergeFrqProgress } from '$lib/users/progress.server';
import type { IProgress } from '$lib/users/records.server';
import type { MasteryTopic, ProgressEntry, StatsData } from '$lib/users/types';

type OverviewRow = {
	total: number;
	correct: number;
	totalTimeMs: number;
	recentTotal: number;
	recentCorrect: number;
};

type CourseRow = {
	course: string;
	total: number;
	correct: number;
	totalTimeMs: number;
};

type FrqOverviewRow = {
	total: number;
	averagePercentage: number;
	totalTimeMs: number;
	recentTotal: number;
};

type FrqCourseRow = {
	course: string;
	total: number;
	totalPercentage: number;
};

export async function getDashboardStats(
	userId: string,
	memberSince: Date,
	timeZone = 'UTC',
	includeFrq = true
): Promise<StatsData> {
	const db = getNeonDatabase();
	const recentCutoff = new Date(Date.now() - 7 * 86_400_000);
	const safeTime = (column: typeof mcqAttempts.timeTakenMs | typeof frqAttempts.timeTakenMs) =>
		sql`least(greatest(coalesce(${column}, 0), 0), ${MAX_ATTEMPT_TIME_MS})`;

	const mcqOverviewPromise = db
		.select({
			total: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} IS NOT NULL)::int`,
			correct: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} = true)::int`,
			totalTimeMs: sql<number>`coalesce(sum(${safeTime(mcqAttempts.timeTakenMs)}), 0)`,
			recentTotal: sql<number>`count(*) FILTER (
				WHERE ${mcqAttempts.wasCorrect} IS NOT NULL
					AND ${mcqAttempts.attemptedAt} >= ${recentCutoff}
			)::int`,
			recentCorrect: sql<number>`count(*) FILTER (
				WHERE ${mcqAttempts.wasCorrect} = true
					AND ${mcqAttempts.attemptedAt} >= ${recentCutoff}
			)::int`
		})
		.from(mcqAttempts)
		.where(eq(mcqAttempts.userId, userId));
	const mcqCoursesPromise = db
		.select({
			course: mcqAttempts.course,
			total: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} IS NOT NULL)::int`,
			correct: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} = true)::int`,
			totalTimeMs: sql<number>`coalesce(sum(${safeTime(mcqAttempts.timeTakenMs)}) FILTER (
				WHERE ${mcqAttempts.wasCorrect} IS NOT NULL
			), 0)`
		})
		.from(mcqAttempts)
		.where(eq(mcqAttempts.userId, userId))
		.groupBy(mcqAttempts.course);
	const frqOverviewPromise: Promise<FrqOverviewRow[]> = includeFrq
		? db
				.select({
					total: sql<number>`count(*)::int`,
					averagePercentage: sql<number>`coalesce(avg(${frqAttempts.percentage}), 0)`,
					totalTimeMs: sql<number>`coalesce(sum(${safeTime(frqAttempts.timeTakenMs)}), 0)`,
					recentTotal: sql<number>`count(*) FILTER (
						WHERE ${frqAttempts.createdAt} >= ${recentCutoff}
					)::int`
				})
				.from(frqAttempts)
				.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.status, 'graded')))
		: Promise.resolve([]);
	const frqCoursesPromise: Promise<FrqCourseRow[]> = includeFrq
		? db
				.select({
					course: frqAttempts.course,
					total: sql<number>`count(*)::int`,
					totalPercentage: sql<number>`coalesce(sum(${frqAttempts.percentage}), 0)`
				})
				.from(frqAttempts)
				.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.status, 'graded')))
				.groupBy(frqAttempts.course)
		: Promise.resolve([]);

	const [mcqRows, mcqCourses, frqRows, frqCourses, currentStreak] = await Promise.all([
		mcqOverviewPromise,
		mcqCoursesPromise,
		frqOverviewPromise,
		frqCoursesPromise,
		getCurrentStreak(userId, timeZone, includeFrq)
	]);
	const mcq: OverviewRow = mcqRows[0] ?? {
		total: 0,
		correct: 0,
		totalTimeMs: 0,
		recentTotal: 0,
		recentCorrect: 0
	};
	const frq: FrqOverviewRow = frqRows[0] ?? {
		total: 0,
		averagePercentage: 0,
		totalTimeMs: 0,
		recentTotal: 0
	};
	const totalQuestions = Number(mcq.total);
	const correctAnswers = Number(mcq.correct);
	const recentQuestions = Number(mcq.recentTotal);
	const recentCorrect = Number(mcq.recentCorrect);
	const frqByCourse = new Map(frqCourses.map((row) => [row.course, row]));
	const mcqByCourse = new Map(mcqCourses.map((row) => [row.course, row]));
	const courses = new Set([...mcqByCourse.keys(), ...frqByCourse.keys()]);

	return {
		overview: {
			totalQuestions,
			correctAnswers,
			accuracy: totalQuestions ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
			currentStreak,
			totalTimeHours:
				Math.round(((Number(mcq.totalTimeMs) + Number(frq.totalTimeMs)) / 1000 / 60 / 60) * 10) /
				10,
			frqSubmissions: Number(frq.total),
			frqAveragePercentage: Math.round(Number(frq.averagePercentage)),
			memberSince: memberSince.toISOString()
		},
		recentPerformance: {
			questionsLast7Days: recentQuestions,
			accuracyLast7Days: recentQuestions ? Math.round((recentCorrect / recentQuestions) * 100) : 0,
			frqSubmissionsLast7Days: Number(frq.recentTotal)
		},
		courseBreakdown: [...courses]
			.map((course) => {
				const mcqCourse: CourseRow = mcqByCourse.get(course) ?? {
					course,
					total: 0,
					correct: 0,
					totalTimeMs: 0
				};
				const frqCourse: FrqCourseRow = frqByCourse.get(course) ?? {
					course,
					total: 0,
					totalPercentage: 0
				};
				const total = Number(mcqCourse.total);
				const correct = Number(mcqCourse.correct);
				const frqAttempts = Number(frqCourse.total);
				return {
					course,
					total,
					correct,
					accuracy: total ? Math.round((correct / total) * 100) : 0,
					avgTimeSeconds: total ? Math.round(Number(mcqCourse.totalTimeMs) / total / 1000) : 0,
					frqAttempts,
					frqAveragePercentage: frqAttempts
						? Math.round(Number(frqCourse.totalPercentage) / frqAttempts)
						: 0
				};
			})
			.sort((a, b) => b.total + b.frqAttempts - (a.total + a.frqAttempts))
	};
}

type RecentAttemptRow = {
	course: string;
	unit: string;
	wasCorrect: boolean;
	attemptedAt: Date;
};

export async function getDashboardProgress(
	userId: string,
	progress: IProgress[],
	includeFrq = true
): Promise<ProgressEntry[]> {
	const db = getNeonDatabase();
	const recentAttemptsPromise = db.execute<RecentAttemptRow>(sql`
		WITH ranked AS (
			SELECT
				${mcqAttempts.course} AS "course",
				${mcqAttempts.unit} AS unit,
				${mcqAttempts.wasCorrect} AS "wasCorrect",
				${mcqAttempts.attemptedAt} AS "attemptedAt",
				row_number() OVER (
					PARTITION BY ${mcqAttempts.course}, ${mcqAttempts.unit}
					ORDER BY ${mcqAttempts.attemptedAt} DESC
				) AS position
			FROM ${mcqAttempts}
			WHERE ${mcqAttempts.userId} = ${userId}
				AND ${mcqAttempts.wasCorrect} IS NOT NULL
		)
		SELECT "course", unit, "wasCorrect", "attemptedAt"
		FROM ranked
		WHERE position <= 20
		ORDER BY "course", unit, "attemptedAt" DESC
	`);
	const topicsCovered = questionPayloadTextField(mcqQuestions.data, 'topicsCovered');
	const topicsPromise = db
		.select({
			course: mcqAttempts.course,
			unit: mcqAttempts.unit,
			name: sql<string>`trim(${topicsCovered})`,
			attempts: count(),
			correctAttempts: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} = true)::int`,
			gradedAttempts: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} IS NOT NULL)::int`,
			lastAttemptAt: max(mcqAttempts.attemptedAt)
		})
		.from(mcqAttempts)
		.innerJoin(mcqQuestions, eq(mcqQuestions.questionId, mcqAttempts.questionId))
		.where(
			and(
				eq(mcqAttempts.userId, userId),
				isNotNull(topicsCovered),
				sql`trim(${topicsCovered}) <> ''`
			)
		)
		.groupBy(mcqAttempts.course, mcqAttempts.unit, sql`trim(${topicsCovered})`);
	const [recentResult, topicRows, frqProgress] = await Promise.all([
		recentAttemptsPromise,
		topicsPromise,
		includeFrq ? getFrqProgressForUser(userId) : Promise.resolve([])
	]);
	const withRecent = buildProgressDataFromAttempts(
		progress,
		recentResult.rows.map((row) => ({
			...row,
			attemptedAt: new Date(row.attemptedAt)
		}))
	);
	const topicsByUnit = new Map<string, MasteryTopic[]>();
	for (const row of topicRows) {
		const attempts = Number(row.attempts);
		const correctAttempts = Number(row.correctAttempts);
		const topic: MasteryTopic = {
			name: row.name,
			attempts,
			correctAttempts,
			mastery: Number(row.gradedAttempts) ? Math.round((correctAttempts / attempts) * 100) : null,
			lastAttemptAt: row.lastAttemptAt?.toISOString()
		};
		const key = `${row.course}\u0000${row.unit}`;
		const list = topicsByUnit.get(key) ?? [];
		list.push(topic);
		topicsByUnit.set(key, list);
	}
	const withTopics = withRecent.map((entry) => ({
		...entry,
		topics: (topicsByUnit.get(`${entry.course}\u0000${entry.unit}`) ?? []).sort(
			(a, b) => b.attempts - a.attempts || a.name.localeCompare(b.name)
		)
	}));
	return mergeFrqProgress(withTopics, frqProgress);
}
