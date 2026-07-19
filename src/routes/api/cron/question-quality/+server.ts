import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAuthorizedCronRequest } from '$lib/auth/cron-auth';
import { recoverActiveReviewJobs } from '$lib/question-quality/service.server';

export const GET: RequestHandler = async ({ request }) => {
	if (!isAuthorizedCronRequest(request, env.CRON_SECRET)) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}
	return json({ recovered: await recoverActiveReviewJobs() });
};
