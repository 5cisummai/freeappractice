import type { RequestHandler } from './$types';
import { getGenerationStatsForApi } from '#lib/question-bank/gen-stats.server.js';
import { logger } from '#lib/server/logger.js';

/** Public read-only stats for MCQs generated and stored in the Neon registry. */
export const GET: RequestHandler = async () => {
	try {
		const stats = await getGenerationStatsForApi();
		return Response.json({ ok: true, stats });
	} catch (err) {
		logger.error('Generation stats error', { error: err });
		return Response.json({ error: 'Failed to load generation stats' }, { status: 500 });
	}
};
