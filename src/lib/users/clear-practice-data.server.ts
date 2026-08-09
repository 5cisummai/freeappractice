import { eq } from 'drizzle-orm';
import { getNeonDatabase } from '$lib/server/neon/db';
import { bookmarks, frqAttempts, mcqAttempts, userProgress } from '$lib/server/neon/schema';

/**
 * Clears practice progress for a user while keeping the account.
 * Removes MCQ history, mastery progress, bookmarks, and FRQ attempts.
 */
export async function clearPracticeDataForUser(userId: string): Promise<void> {
	const db = getNeonDatabase();
	await db.batch([
		db.delete(userProgress).where(eq(userProgress.userId, userId)),
		db.delete(mcqAttempts).where(eq(mcqAttempts.userId, userId)),
		db.delete(bookmarks).where(eq(bookmarks.userId, userId)),
		db.delete(frqAttempts).where(eq(frqAttempts.userId, userId))
	]);
}
