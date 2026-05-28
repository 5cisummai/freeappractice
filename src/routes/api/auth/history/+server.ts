import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';
import { getMcqHistoryPage, hydrateMcqHistoryItems } from '$lib/server/services/history';

export const GET: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const limit = Math.min(parseInt(event.url.searchParams.get('limit') ?? '50', 10) || 50, 200);
		const page = Math.max(parseInt(event.url.searchParams.get('page') ?? '1', 10) || 1, 1);
		const apClass = event.url.searchParams.get('apClass')?.trim() || undefined;

		await connectDb();

		const user = await User.findById(userId).select('questionHistory');
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const pageResult = getMcqHistoryPage(user, { page, limit, apClass });
		const items = await hydrateMcqHistoryItems(pageResult.items);

		return json({
			items,
			total: pageResult.total,
			page: pageResult.page,
			limit: pageResult.limit
		});
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('History error', { error: err });
		return json({ error: 'Failed to get history' }, { status: 500 });
	}
};
