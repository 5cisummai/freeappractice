import { json } from '@sveltejs/kit';
import { getQuestionsByIds } from '$lib/questions/storage.server';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { findUserProfileOrFail } from '$lib/users/profile.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const user = await findUserProfileOrFail(userId, 'bookmarkedQuestions');
		const questions = await getQuestionsByIds(user.bookmarkedQuestions);
		return json({ bookmarks: questions });
	},
	{ logLabel: 'Get bookmarks error', errorMessage: 'Failed to fetch bookmarks' }
);

export const POST = withAuthedHandler(
	async (event, userId) => {
		const { questionId } = await event.request.json();
		if (!questionId || typeof questionId !== 'string') {
			return json({ error: 'questionId is required' }, { status: 400 });
		}

		const user = await findUserProfileOrFail(userId);

		const index = user.bookmarkedQuestions.indexOf(questionId);
		if (index > -1) {
			user.bookmarkedQuestions.splice(index, 1);
		} else {
			user.bookmarkedQuestions.push(questionId);
		}

		await user.save();

		const bookmarked = index === -1;
		capturePostHogServerEvent(event.request, {
			distinctId: userId,
			event: 'question_bookmark_toggled',
			properties: {
				question_id: questionId,
				bookmarked
			}
		});

		return json({
			message: bookmarked ? 'Bookmark added' : 'Bookmark removed',
			bookmarked
		});
	},
	{ logLabel: 'Bookmark error', errorMessage: 'Failed to bookmark question' }
);
