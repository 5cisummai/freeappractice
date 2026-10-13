import { CRON_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';
import { isAuthorizedCronRequest } from '#lib/auth/cron-auth.js';
import { logger } from '#lib/server/logger.js';
import { runAgentRetention } from '#lib/agent/memory/maintenance.server.js';
import { runBillingMaintenance } from '#lib/billing/maintenance.server.js';
import { runPendingAccountCleanup } from '#lib/users/account-cleanup.server.js';

export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, CRON_SECRET)) {
		return Response.json({ message: 'Unauthorized' }, { status: 401 });
	}
	try {
		const expiredGrantsRemoved = await runBillingMaintenance();
		const retention = await runAgentRetention();
		const accountCleanup = await runPendingAccountCleanup();
		const maintenance = {
			...retention,
			expiredGrantsRemoved,
			cleanupCompleted: retention.cleanupCompleted + accountCleanup.cleanupCompleted,
			cleanupRetried: retention.cleanupRetried + accountCleanup.cleanupRetried
		};
		logger.info('[cron/super-maintenance] run complete', maintenance);
		return Response.json({ maintenance });
	} catch (error) {
		logger.error('[cron/super-maintenance] run failed', { error });
		return Response.json({ error: 'Super maintenance failed' }, { status: 500 });
	}
};
