import { and, count, eq, isNotNull, max, sql } from 'drizzle-orm';
import { getFrqProgressForUser } from '$lib/frq/attempts.server';
import { frqAttemptGrades, frqAttempts, mcqAttempts, mcqQuestions } from '$lib/server/neon/schema';
import { getNeonDatabase } from '$lib/server/neon/db';
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

type SubjectRow = {
	subject: string;
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

type FrqSubjectRow = {
	subject: string;
	total: number;
	totalPercentage: number;
};

function localDayKey(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

async function getCurrentStreak(
	userId: string,
	timeZone: string,
	includeFrq: boolean
): Promise<number> {
	const db = getNeonDatabase();
	const today = localDayKey(new Date(), timeZone);
	const frqDays = includeFrq
		? sql`
			UNION
			SELECT DISTINCT (${frqAttempts.createdAt} AT TIME ZONE ${timeZone})::date AS day
			FROM ${frqAttempts}
			WHERE ${frqAttempts.userId} = ${userId} AND ${frqAttempts.status} = 'graded'
		`
		: sql``;
	const result = await db.execute<{ streak: number }>(sql`
		WITH activity_days AS (
			SELECT DISTINCT (${mcqAttempts.attemptedAt} AT TIME ZONE ${timeZone})::date AS day
			FROM ${mcqAttempts}
			WHERE ${mcqAttempts.userId} = ${userId}
			${frqDays}
		),
		anchor AS (
			SELECT CASE
				WHEN EXISTS (SELECT 1 FROM activity_days WHERE day = ${today}::date)
					THEN ${today}::date
				WHEN EXISTS (SELECT 1 FROM activity_days WHERE day = ${today}::date - 1)
					THEN ${today}::date - 1
				ELSE NULL::date
			END AS day
		),
		ordered AS (
			SELECT activity_days.day,
				row_number() OVER (ORDER BY activity_days.day DESC)::int AS position
			FROM activity_days
			CROSS JOIN anchor
			WHERE anchor.day IS NOT NULL AND activity_days.day <= anchor.day
		)
		SELECT count(*) FILTER (
			WHERE ordered.day = anchor.day - (ordered.position - 1)
		)::int AS streak
		FROM ordered
		CROSS JOIN anchor
		GROUP BY anchor.day
	`);
	return Number(result.rows[0]?.streak ?? 0);
}

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
	const mcqSubjectsPromise = db
		.select({
			subject: mcqAttempts.apClass,
			total: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} IS NOT NULL)::int`,
			correct: sql<number>`count(*) FILTER (WHERE ${mcqAttempts.wasCorrect} = true)::int`,
			totalTimeMs: sql<number>`coalesce(sum(${safeTime(mcqAttempts.timeTakenMs)}) FILTER (
				WHERE ${mcqAttempts.wasCorrect} IS NOT NULL
			), 0)`
		})
		.from(mcqAttempts)
		.where(eq(mcqAttempts.userId, userId))
		.groupBy(mcqAttempts.apClass);
	const frqOverviewPromise: Promise<FrqOverviewRow[]> = includeFrq
		? db
				.select({
					total: sql<number>`count(*)::int`,
					averagePercentage: sql<number>`coalesce(avg(${frqAttemptGrades.percentage}), 0)`,
					totalTimeMs: sql<number>`coalesce(sum(${safeTime(frqAttempts.timeTakenMs)}), 0)`,
					recentTotal: sql<number>`count(*) FILTER (
						WHERE ${frqAttempts.createdAt} >= ${recentCutoff}
					)::int`
				})
				.from(frqAttempts)
				.innerJoin(frqAttemptGrades, eq(frqAttemptGrades.attemptId, frqAttempts.id))
				.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.status, 'graded')))
		: Promise.resolve([]);
	const frqSubjectsPromise: Promise<FrqSubjectRow[]> = includeFrq
		? db
				.select({
					subject: frqAttempts.apClass,
					total: sql<number>`count(*)::int`,
					totalPercentage: sql<number>`coalesce(sum(${frqAttemptGrades.percentage}), 0)`
				})
				.from(frqAttempts)
				.innerJoin(frqAttemptGrades, eq(frqAttemptGrades.attemptId, frqAttempts.id))
				.where(and(eq(frqAttempts.userId, userId), eq(frqAttempts.status, 'graded')))
				.groupBy(frqAttempts.apClass)
		: Promise.resolve([]);

	const [mcqRows, mcqSubjects, frqRows, frqSubjects, currentStreak] = await Promise.all([
		mcqOverviewPromise,
		mcqSubjectsPromise,
		frqOverviewPromise,
		frqSubjectsPromise,
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
	const frqBySubject = new Map(frqSubjects.map((row) => [row.subject, row]));
	const mcqBySubject = new Map(mcqSubjects.map((row) => [row.subject, row]));
	const subjects = new Set([...mcqBySubject.keys(), ...frqBySubject.keys()]);

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
		subjectBreakdown: [...subjects]
			.map((subject) => {
				const mcqSubject: SubjectRow = mcqBySubject.get(subject) ?? {
					subject,
					total: 0,
					correct: 0,
					totalTimeMs: 0
				};
				const frqSubject: FrqSubjectRow = frqBySubject.get(subject) ?? {
					subject,
					total: 0,
					totalPercentage: 0
				};
				const total = Number(mcqSubject.total);
				const correct = Number(mcqSubject.correct);
				const frqAttempts = Number(frqSubject.total);
				return {
					subject,
					total,
					correct,
					accuracy: total ? Math.round((correct / total) * 100) : 0,
					avgTimeSeconds: total ? Math.round(Number(mcqSubject.totalTimeMs) / total / 1000) : 0,
					frqAttempts,
					frqAveragePercentage: frqAttempts
						? Math.round(Number(frqSubject.totalPercentage) / frqAttempts)
						: 0
				};
			})
			.sort((a, b) => b.total + b.frqAttempts - (a.total + a.frqAttempts))
	};
}

type RecentAttemptRow = {
	apClass: string;
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
				${mcqAttempts.apClass} AS "apClass",
				${mcqAttempts.unit} AS unit,
				${mcqAttempts.wasCorrect} AS "wasCorrect",
				${mcqAttempts.attemptedAt} AS "attemptedAt",
				row_number() OVER (
					PARTITION BY ${mcqAttempts.apClass}, ${mcqAttempts.unit}
					ORDER BY ${mcqAttempts.attemptedAt} DESC
				) AS position
			FROM ${mcqAttempts}
			WHERE ${mcqAttempts.userId} = ${userId}
				AND ${mcqAttempts.wasCorrect} IS NOT NULL
		)
		SELECT "apClass", unit, "wasCorrect", "attemptedAt"
		FROM ranked
		WHERE position <= 20
		ORDER BY "apClass", unit, "attemptedAt" DESC
	`);
	const topicsPromise = db
		.select({
			apClass: mcqAttempts.apClass,
			unit: mcqAttempts.unit,
			name: sql<string>`trim(${mcqQuestions.topicsCovered})`,
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
				isNotNull(mcqQuestions.topicsCovered),
				sql`trim(${mcqQuestions.topicsCovered}) <> ''`
			)
		)
		.groupBy(mcqAttempts.apClass, mcqAttempts.unit, sql`trim(${mcqQuestions.topicsCovered})`);
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
		const key = `${row.apClass}\u0000${row.unit}`;
		const list = topicsByUnit.get(key) ?? [];
		list.push(topic);
		topicsByUnit.set(key, list);
	}
	const withTopics = withRecent.map((entry) => ({
		...entry,
		topics: (topicsByUnit.get(`${entry.apClass}\u0000${entry.unit}`) ?? []).sort(
			(a, b) => b.attempts - a.attempts || a.name.localeCompare(b.name)
		)
	}));
	return mergeFrqProgress(withTopics, frqProgress);
}
