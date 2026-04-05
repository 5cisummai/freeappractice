import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		await connectDb();

		const user = await User.findById(userId).select('progress');
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		return json({ progress: user.progress });
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Progress error', { error: err });
		return json({ error: 'Failed to get progress' }, { status: 500 });
	}
};
