import { json } from '@sveltejs/kit';
import { getQuestionsFromS3 } from '$lib/server/services/question-storage';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { findUserOrFail } from '$lib/server/utils';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserOrFail(userId, 'bookmarkedQuestions');
		const questions = await getQuestionsFromS3(user.bookmarkedQuestions);
		return json({ bookmarks: questions });
	},
	{ logLabel: 'Get bookmarks error', errorMessage: 'Failed to fetch bookmarks' }
);
