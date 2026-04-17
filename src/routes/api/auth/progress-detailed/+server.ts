import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';
import { calcStreak } from '$lib/server/utils';

export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		await connectDb();

		const user = await User.findById(userId).select(
			'-password -emailToken -emailTokenExpires -resetPasswordToken -resetPasswordExpires'
		);
		if (!user) return json({ error: 'User not found' }, { status: 404 });

		const history = user.questionHistory ?? [];
		const totalQuestions = history.length;
		const correctAnswers = history.filter((q) => q.wasCorrect).length;
		const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
		const totalTimeMs = history.reduce((sum, q) => sum + (q.timeTakenMs ?? 0), 0);
		const totalTimeHours = Math.round((totalTimeMs / 1000 / 60 / 60) * 10) / 10;
		const currentStreak = calcStreak(history);

		return json({
			user: { userId: user._id, name: user.name, email: user.email, createdAt: user.createdAt },
			stats: { totalQuestions, correctAnswers, accuracy, currentStreak, totalTimeHours },
			questionHistory: history,
			progress: user.progress,
			bookmarkedQuestions: user.bookmarkedQuestions
		});
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Detailed progress error', { error: err });
		return json({ error: 'Failed to fetch detailed progress' }, { status: 500 });
	}
};
