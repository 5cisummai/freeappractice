import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/auth/route-helpers.server';
import { getBookmarkedQuestions, toggleBookmark } from '$lib/users/bookmarks.server';
import { capturePostHogServerEvent } from '$lib/server/posthog';

export const GET = withAuthedHandler(
	async (_event, userId) => {
		const questions = await getBookmarkedQuestions(userId);
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

		const bookmarked = await toggleBookmark(userId, questionId);
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
