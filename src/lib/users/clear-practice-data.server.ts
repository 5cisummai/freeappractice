import { UserProfile } from '$lib/users/model.server';
import { FrqAttempt } from '$lib/frq/model.server';

/**
 * Clears practice progress for a user while keeping the account.
 * Removes MCQ history, mastery progress, bookmarks, and FRQ attempts.
 */
export async function clearPracticeDataForUser(userId: string): Promise<void> {
	await UserProfile.updateOne(
		{ userId },
		{
			$set: {
				progress: [],
				questionHistory: [],
				bookmarkedQuestions: []
			}
		}
	).exec();
	await FrqAttempt.deleteMany({ userId }).exec();
}
