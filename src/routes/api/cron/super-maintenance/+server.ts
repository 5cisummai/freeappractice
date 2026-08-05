import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthorizedCronRequest } from '$lib/auth/cron-auth';
import { logger } from '$lib/server/logger';
import { runSuperMaintenance } from '$lib/super/maintenance.server';

export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}
	try {
		const maintenance = await runSuperMaintenance();
		logger.info('[cron/super-maintenance] run complete', maintenance);
		return json({ maintenance });
	} catch (error) {
		logger.error('[cron/super-maintenance] run failed', { error });
		return json({ error: 'Super maintenance failed' }, { status: 500 });
	}
};
