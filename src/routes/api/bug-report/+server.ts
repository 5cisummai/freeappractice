import type { RequestHandler } from './$types';
import { submitBugReport } from '$lib/bug-report/server';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	return submitBugReport(request, getClientAddress());
};
