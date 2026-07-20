import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthorizedCronRequest } from '$lib/auth/cron-auth';
import { runQuestionPoolRefillWorker } from '$lib/questions/pool-refill.server';
import { QUESTION_POOL_CONFIG } from '$lib/questions/pool-constants';
import { logger } from '$lib/server/logger';

export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const summary = await runQuestionPoolRefillWorker(QUESTION_POOL_CONFIG);
		logger.info('[cron/question-pool] refill run complete', summary);
		return json(summary);
	} catch (error) {
		logger.error('[cron/question-pool] refill run failed', { error });
		return json(
			{
				error: 'Question pool refill failed',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
