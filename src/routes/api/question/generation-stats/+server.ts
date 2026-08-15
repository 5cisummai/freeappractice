import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGenerationStatsForApi } from '$lib/question-bank/gen-stats.server';
import { logger } from '$lib/server/logger';

/** Public read-only stats for MCQs generated and stored in the Neon registry. */
export const GET: RequestHandler = async () => {
	try {
		const stats = await getGenerationStatsForApi();
		return json({ ok: true, stats });
	} catch (err) {
		logger.error('Generation stats error', { error: err });
		return json({ error: 'Failed to load generation stats' }, { status: 500 });
	}
};
