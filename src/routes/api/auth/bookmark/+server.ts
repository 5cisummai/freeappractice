import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const { questionId } = await event.request.json();
		if (!questionId || typeof questionId !== 'string') {
			return json({ error: 'questionId is required' }, { status: 400 });
		}

		await connectDb();

		const user = await User.findById(userId);
		if (!user) return json({ error: 'User not found' }, { status: 404 });

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
	} catch (err) {
		if (err instanceof Response) return err;
		console.error('Bookmark error:', err);
		return json({ error: 'Failed to bookmark question' }, { status: 500 });
	}
};
