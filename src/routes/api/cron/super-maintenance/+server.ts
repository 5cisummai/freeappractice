import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthorizedCronRequest } from '$lib/auth/cron-auth';
import { logger } from '$lib/server/logger';
import { runAgentRetention } from '$lib/agent/memory/maintenance.server';
import { runBillingMaintenance } from '$lib/billing/maintenance.server';
import { runPendingAccountCleanup } from '$lib/users/account-cleanup.server';

export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
		return json({ message: 'Unauthorized' }, { status: 401 });
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
		return json({ maintenance });
	} catch (error) {
		logger.error('[cron/super-maintenance] run failed', { error });
		return json({ error: 'Super maintenance failed' }, { status: 500 });
	}
};
