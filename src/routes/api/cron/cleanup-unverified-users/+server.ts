import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { isAuthorizedCronRequest } from '$lib/auth/cron-auth';
import { cleanupUnverifiedUsers } from '$lib/auth/cleanup-unverified-users.server';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
		error(401, 'Unauthorized');
	}

	try {
		const result = await cleanupUnverifiedUsers();
		return json({ ok: true, ...result });
	} catch (err) {
		logger.error('cron cleanup-unverified-users failed', { error: err });
		error(500, 'Cleanup failed');
	}
};
