import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGenerationStatsForApi } from '$lib/server/services/question-gen-stats';

/** Public read-only stats for MCQs generated and stored (Mongo-backed, updated on each new generation). */
export const GET: RequestHandler = async () => {
	try {
		const stats = await getGenerationStatsForApi();
		return json({ ok: true, stats });
	} catch (err) {
		console.error('generation-stats error:', err);
		return json({ error: 'Failed to load generation stats' }, { status: 500 });
	}
};
