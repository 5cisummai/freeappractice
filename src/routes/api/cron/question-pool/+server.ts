import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';
import { isAuthorizedCronRequest } from '#lib/auth/cron-auth.js';
import { refill } from '#lib/question-bank/ops.server.js';
import { QUESTION_POOL_CONFIG } from '#lib/question-bank/pool-constants.js';
import { logger } from '#lib/server/logger.js';

export const config = { maxDuration: 300 };

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, CRON_SECRET)) {
		return Response.json({ message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const pool = await refill({ mode: 'run', config: QUESTION_POOL_CONFIG });
		logger.info('[cron/question-pool] refill run complete', pool);
		return Response.json({ questionPool: pool });
	} catch (error) {
		logger.error('[cron/question-pool] refill run failed', { error });
		return Response.json({ error: 'Question-pool maintenance failed' }, { status: 500 });
	}
};
