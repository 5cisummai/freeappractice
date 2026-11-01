import { and, asc, eq, sql } from 'drizzle-orm';
import {
	getQuestionsByIds,
	type StoredQuestion
} from '#lib/question-bank/mcq/repository.server.js';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import { bookmarks } from '#lib/server/neon/schema.js';
import type { PracticeContext } from '#lib/users/practice-context.server.js';

/** Return bookmarked questions in the order in which the user saved them. */
export async function getBookmarkedQuestions(
	userId: string,
	context: PracticeContext = { organizationId: null }
): Promise<StoredQuestion[]> {
	const rows = await getNeonDatabase()
		.select({ questionId: bookmarks.questionId })
		.from(bookmarks)
		.where(
			and(
				eq(bookmarks.userId, userId),
				sql`${bookmarks.organizationId} IS NOT DISTINCT FROM ${context.organizationId}`
			)
		)
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
export async function toggleBookmark(
	userId: string,
	questionId: string,
	context: PracticeContext = { organizationId: null }
): Promise<boolean> {
	const conflictTarget = context.organizationId
		? sql`ON CONFLICT (organization_id, user_id, question_id)
			WHERE organization_id IS NOT NULL DO NOTHING`
		: sql`ON CONFLICT (user_id, question_id)
			WHERE organization_id IS NULL DO NOTHING`;
	const result = await getNeonDatabase().execute<{ bookmarked: boolean }>(sql`
		WITH existing AS MATERIALIZED (
			SELECT 1
			FROM ${bookmarks}
			WHERE ${bookmarks.userId} = ${userId}
				AND ${bookmarks.questionId} = ${questionId}
				AND ${bookmarks.organizationId} IS NOT DISTINCT FROM ${context.organizationId}
			LIMIT 1
			FOR UPDATE
		),
		removed AS (
			DELETE FROM ${bookmarks}
			WHERE ${bookmarks.userId} = ${userId}
				AND ${bookmarks.questionId} = ${questionId}
				AND ${bookmarks.organizationId} IS NOT DISTINCT FROM ${context.organizationId}
				AND EXISTS (SELECT 1 FROM existing)
			RETURNING ${bookmarks.questionId}
		),
		added AS (
			INSERT INTO ${bookmarks} (${bookmarks.userId}, ${bookmarks.organizationId}, ${bookmarks.questionId})
			SELECT ${userId}, ${context.organizationId}, ${questionId}
			WHERE NOT EXISTS (SELECT 1 FROM existing)
			${conflictTarget}
			RETURNING ${bookmarks.questionId}
		)
		SELECT NOT EXISTS (SELECT 1 FROM existing) AS bookmarked
	`);
	const row = result.rows[0];

	if (!row) throw new Error('Bookmark toggle did not return a state');
	return row.bookmarked;
}
