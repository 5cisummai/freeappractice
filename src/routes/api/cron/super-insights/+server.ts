import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthorizedCronRequest } from '$lib/auth/cron-auth';
import { logger } from '$lib/server/logger';
import { runWeeklyInsights } from '$lib/super/insights.server';

export const config = { maxDuration: 300 };

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	try {
		const insights = await runWeeklyInsights();
		logger.info('[cron/super-insights] run complete', insights);
		return json({ insights });
	} catch (error) {
		logger.error('[cron/super-insights] run failed', { error });
		return json({ error: 'Weekly Insights generation failed' }, { status: 500 });
	}
};
