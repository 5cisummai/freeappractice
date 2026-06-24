import { json } from '@sveltejs/kit';
import { getQuestionsFromS3 } from '$lib/questions/storage.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'bookmarkedQuestions');
		const questions = await getQuestionsFromS3(user.bookmarkedQuestions);
		return json({ bookmarks: questions });
	},
	{ logLabel: 'Get bookmarks error', errorMessage: 'Failed to fetch bookmarks' }
);
