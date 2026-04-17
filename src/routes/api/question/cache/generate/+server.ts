import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAndStoreQuestion } from '$lib/server/services/question-cache';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { className, unit } = await request.json();

		if (typeof className !== 'string' || !className.trim()) {
			return json(
				{ error: 'className is required and must be a non-empty string' },
				{ status: 400 }
			);
		}
		if (unit !== undefined && typeof unit !== 'string') {
			return json({ error: 'unit must be a string if provided' }, { status: 400 });
		}

		const result = await generateAndStoreQuestion(className.trim(), unit ?? '');
		return json({ success: true, message: 'Question generated and cached', data: result });
	} catch (err) {
		logger.error('Generate cached question error', { error: err });
		return json({ error: 'Failed to generate question' }, { status: 500 });
	}
};
