import { asc, eq, sql } from 'drizzle-orm';
import { getQuestionsByIds, type StoredQuestion } from '$lib/questions/repository.server';
import { getNeonDatabase } from '$lib/server/neon/db';
import { bookmarks } from '$lib/server/neon/schema';

/** Return bookmarked questions in the order in which the user saved them. */
export async function getBookmarkedQuestions(userId: string): Promise<StoredQuestion[]> {
	const rows = await getNeonDatabase()
		.select({ questionId: bookmarks.questionId })
		.from(bookmarks)
		.where(eq(bookmarks.userId, userId))
		.orderBy(asc(bookmarks.createdAt));

	return getQuestionsByIds(rows.map((row) => row.questionId));
}

/**
 * Atomically toggle one bookmark and return the state after the toggle.
 *
 * The existing-row CTE locks the row before deciding whether to delete or
 * insert. A concurrent insert that wins the unique key race still represents
 * the bookmarked state, so both callers return true for that case.
 */
export async function toggleBookmark(userId: string, questionId: string): Promise<boolean> {
	const result = await getNeonDatabase().execute<{ bookmarked: boolean }>(sql`
		WITH existing AS MATERIALIZED (
			SELECT 1
			FROM ${bookmarks}
			WHERE ${bookmarks.userId} = ${userId}
				AND ${bookmarks.questionId} = ${questionId}
			LIMIT 1
			FOR UPDATE
		),
		removed AS (
			DELETE FROM ${bookmarks}
			WHERE ${bookmarks.userId} = ${userId}
				AND ${bookmarks.questionId} = ${questionId}
				AND EXISTS (SELECT 1 FROM existing)
			RETURNING ${bookmarks.questionId}
		),
		added AS (
			INSERT INTO ${bookmarks} (${bookmarks.userId}, ${bookmarks.questionId})
			SELECT ${userId}, ${questionId}
			WHERE NOT EXISTS (SELECT 1 FROM existing)
			ON CONFLICT (${bookmarks.userId}, ${bookmarks.questionId}) DO NOTHING
			RETURNING ${bookmarks.questionId}
		)
		SELECT NOT EXISTS (SELECT 1 FROM existing) AS bookmarked
	`);
	const row = result.rows[0];

	if (!row) throw new Error('Bookmark toggle did not return a state');
	return row.bookmarked;
}
