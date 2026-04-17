import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const limit = Math.min(parseInt(event.url.searchParams.get('limit') ?? '50'), 200);
		const page = Math.max(parseInt(event.url.searchParams.get('page') ?? '1'), 1);
		const skip = (page - 1) * limit;

		await connectDb();

		const user = await User.findById(userId).select('questionHistory');
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const total = user.questionHistory.length;
		const history = user.questionHistory
			.slice()
			.reverse()
			.slice(skip, skip + limit);

		return json({ history, total, page, limit });
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('History error', { error: err });
		return json({ error: 'Failed to get history' }, { status: 500 });
	}
};
