import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCacheStats } from '$lib/server/services/question-cache';

export const GET: RequestHandler = async () => {
	try {
		const stats = await getCacheStats();
		return json(stats);
	} catch (err) {
		console.error('Cache stats error:', err);
		return json({ error: 'Failed to get cache stats' }, { status: 500 });
	}
};
