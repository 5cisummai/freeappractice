import { sql, type SQL } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { frqAttempts, mcqAttempts } from '$lib/server/neon/schema';

function localDayKey(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

function localDayStart(day: SQL, timeZone: string): SQL {
	return sql`((${day})::date::timestamp AT TIME ZONE ${timeZone})`;
}

function localDayEnd(day: SQL, timeZone: string): SQL {
	return sql`(((${day})::date + 1)::timestamp AT TIME ZONE ${timeZone})`;
}

function hasMcqActivity(userId: SQL, day: SQL, timeZone: string): SQL {
	return sql`EXISTS (
		SELECT 1
		FROM ${mcqAttempts}
		WHERE ${mcqAttempts.userId} = ${userId}
			AND ${mcqAttempts.attemptedAt} >= ${localDayStart(day, timeZone)}
			AND ${mcqAttempts.attemptedAt} < ${localDayEnd(day, timeZone)}
	)`;
}

function hasActivity(userId: SQL, day: SQL, timeZone: string, includeFrq: boolean): SQL {
	const mcqActivity = hasMcqActivity(userId, day, timeZone);
	if (!includeFrq) return mcqActivity;
	return sql`(
		${mcqActivity}
		OR EXISTS (
			SELECT 1
			FROM ${frqAttempts}
			WHERE ${frqAttempts.userId} = ${userId}
				AND ${frqAttempts.status} = 'graded'
				AND ${frqAttempts.createdAt} >= ${localDayStart(day, timeZone)}
				AND ${frqAttempts.createdAt} < ${localDayEnd(day, timeZone)}
		)
	)`;
}

/**
 * Follow the current contiguous streak backwards with indexed day-range probes.
 * Work is proportional to the active streak, not the user's lifetime attempt history.
 */
export async function getCurrentStreak(
	userId: string,
	timeZone: string,
	includeFrq: boolean
): Promise<number> {
	const today = localDayKey(new Date(), timeZone);
	const user = sql`${userId}`;
	const todayDay = sql`${today}::date`;
	const yesterday = sql`${today}::date - 1`;
	const previousStreakDay = sql`streak_days.day - 1`;
	const result = await getNeonDatabase().execute<{ streak: number }>(sql`
		WITH RECURSIVE anchor AS (
			SELECT CASE
				WHEN ${hasActivity(user, todayDay, timeZone, includeFrq)} THEN ${today}::date
				WHEN ${hasActivity(user, yesterday, timeZone, includeFrq)} THEN ${today}::date - 1
				ELSE NULL::date
			END AS day
		),
		streak_days(day) AS (
			SELECT day FROM anchor WHERE day IS NOT NULL
			UNION ALL
			SELECT streak_days.day - 1
			FROM streak_days
			WHERE ${hasActivity(user, previousStreakDay, timeZone, includeFrq)}
		)
		SELECT count(*)::int AS streak FROM streak_days
	`);
	return Number(result.rows[0]?.streak ?? 0);
}

/** Compute MCQ streaks for a group without scanning every historical attempt. */
export async function getCurrentMcqStreaksForUsers(
	userIds: string[],
	timeZone: string
): Promise<Array<{ userId: string; currentStreak: number }>> {
	if (userIds.length === 0) return [];
	const today = localDayKey(new Date(), timeZone);
	const requestedUser = sql.raw('requested_users.user_id');
	const todayDay = sql`${today}::date`;
	const yesterday = sql`${today}::date - 1`;
	const streakUser = sql.raw('streak_days.user_id');
	const previousStreakDay = sql`streak_days.day - 1`;
	const values = sql.join(
		userIds.map((userId) => sql`(${userId}::text)`),
		sql`, `
	);
	const result = await getNeonDatabase().execute<{ userId: string; currentStreak: number }>(sql`
		WITH RECURSIVE requested_users(user_id) AS (
			VALUES ${values}
		),
		anchors(user_id, anchor_day) AS (
			SELECT requested_users.user_id,
				CASE
					WHEN ${hasMcqActivity(requestedUser, todayDay, timeZone)} THEN ${today}::date
					WHEN ${hasMcqActivity(requestedUser, yesterday, timeZone)} THEN ${today}::date - 1
					ELSE NULL::date
				END
			FROM requested_users
		),
		streak_days(user_id, day) AS (
			SELECT anchors.user_id, anchors.anchor_day
			FROM anchors
			WHERE anchors.anchor_day IS NOT NULL
			UNION ALL
			SELECT streak_days.user_id, streak_days.day - 1
			FROM streak_days
			WHERE ${hasMcqActivity(streakUser, previousStreakDay, timeZone)}
		)
		SELECT user_id AS "userId", count(*)::int AS "currentStreak"
		FROM streak_days
		GROUP BY user_id
	`);
	return result.rows.map((row) => ({
		userId: row.userId,
		currentStreak: Number(row.currentStreak)
	}));
}
