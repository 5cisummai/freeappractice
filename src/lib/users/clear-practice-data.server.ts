import { and, eq, isNull } from 'drizzle-orm';
import { getNeonDatabase } from '#lib/server/neon/db.js';
import {
	bookmarks,
	frqAttempts,
	mcqAttempts,
	quizAttempts,
	examAttempts,
	userProgress,
	practiceActivityEvents,
	practiceSessions,
	seenQuestions
} from '#lib/server/neon/schema.js';

/**
 * Clears practice progress for a user while keeping the account.
 * Removes MCQ history, mastery progress, bookmarks, and FRQ attempts.
 */
export async function clearPracticeDataForUser(userId: string): Promise<void> {
	const db = getNeonDatabase();
	await db.batch([
		db
			.delete(userProgress)
			.where(and(eq(userProgress.userId, userId), isNull(userProgress.organizationId))),
		db
			.delete(mcqAttempts)
			.where(and(eq(mcqAttempts.userId, userId), isNull(mcqAttempts.organizationId))),
		db
			.delete(quizAttempts)
			.where(and(eq(quizAttempts.userId, userId), isNull(quizAttempts.organizationId))),
		db
			.delete(examAttempts)
			.where(and(eq(examAttempts.userId, userId), isNull(examAttempts.organizationId))),
		db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), isNull(bookmarks.organizationId))),
		db
			.delete(frqAttempts)
			.where(and(eq(frqAttempts.userId, userId), isNull(frqAttempts.organizationId))),
		db
			.delete(practiceSessions)
			.where(and(eq(practiceSessions.userId, userId), isNull(practiceSessions.organizationId))),
		db.delete(practiceActivityEvents).where(eq(practiceActivityEvents.userId, userId)),
		db
			.delete(seenQuestions)
			.where(and(eq(seenQuestions.userId, userId), isNull(seenQuestions.organizationId)))
	]);
}
