import { json } from '@sveltejs/kit';
import { getQuestionsByIds } from '$lib/questions/lookup.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'bookmarkedQuestions');
		const questions = await getQuestionsByIds(user.bookmarkedQuestions);
		return json({ bookmarks: questions });
	},
	{ logLabel: 'Get bookmarks error', errorMessage: 'Failed to fetch bookmarks' }
);
