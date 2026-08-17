import type { RequestHandler } from './$types';
import { submitAppFeedback } from '$lib/feedback/server';

export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	return submitAppFeedback(request, getClientAddress(), locals.userId);
};
