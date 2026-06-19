import { json } from '@sveltejs/kit';
import { withAuthedHandler } from '$lib/server/route-helpers';
import { findUserOrFail } from '$lib/server/utils';

export const POST = withAuthedHandler(
	async (event, userId) => {
		const { questionId } = await event.request.json();
		if (!questionId || typeof questionId !== 'string') {
			return json({ error: 'questionId is required' }, { status: 400 });
		}

		const user = await findUserOrFail(userId);

		const index = user.bookmarkedQuestions.indexOf(questionId);
		if (index > -1) {
			user.bookmarkedQuestions.splice(index, 1);
		} else {
			user.bookmarkedQuestions.push(questionId);
		}

		await user.save();

		return json({
			message: index > -1 ? 'Bookmark removed' : 'Bookmark added',
			bookmarked: index === -1
		});
	},
	{ logLabel: 'Bookmark error', errorMessage: 'Failed to bookmark question' }
);
