import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { getQuestionsFromS3 } from '$lib/server/services/question-storage';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		await connectDb();

		const user = await User.findById(userId).select('bookmarkedQuestions');
		if (!user) return json({ error: 'User not found' }, { status: 404 });

		const questions = await getQuestionsFromS3(user.bookmarkedQuestions);

		return json({ bookmarks: questions });
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Get bookmarks error', { error: err });
		return json({ error: 'Failed to fetch bookmarks' }, { status: 500 });
	}
};
