import { connectDb } from '$lib/server/db';
import { UserProfile } from '$lib/users/model.server';
import { FrqAttempt } from '$lib/frq/model.server';

/**
 * Clears practice progress for a user while keeping the account.
 * Removes MCQ history, mastery progress, bookmarks, and FRQ attempts.
 */
export async function clearPracticeDataForUser(userId: string): Promise<void> {
	await connectDb();

	await Promise.all([
		UserProfile.updateOne(
			{ userId },
			{
				$set: {
					progress: [],
					questionHistory: [],
					bookmarkedQuestions: []
				}
			}
		),
		FrqAttempt.deleteMany({ userId })
	]);
}
