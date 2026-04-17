import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuestionFromS3 } from '$lib/server/services/question-storage';
import { requireAuth } from '$lib/server/auth';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	try {
		await requireAuth(event);

		const { id } = event.params;
		if (!id) return json({ error: 'Question ID is required' }, { status: 400 });

		const question = await getQuestionFromS3(id);
		if (!question) return json({ error: 'Question not found' }, { status: 404 });

		return json({ question });
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Get question error', { error: err });
		return json({ error: 'Failed to fetch question' }, { status: 500 });
	}
};
