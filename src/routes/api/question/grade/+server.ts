import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gradeSubmittedMcqAttempts } from '$lib/question-bank/mcq/grade-attempt.server';
import { logger } from '$lib/server/logger';
import { readJsonBody, RequestBodyTooLargeError } from '$lib/server/request-body.server';

const MAX_REQUEST_BYTES = 16 * 1024;

/** Grade submitted MCQ choices and return the key only after an attempt. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await readJsonBody(request, MAX_REQUEST_BYTES);
		const result = await gradeSubmittedMcqAttempts(body);
		return json(result.body, { status: result.status });
	} catch (error) {
		if (error instanceof RequestBodyTooLargeError) {
			return json({ error: 'Request body is too large' }, { status: 413 });
		}
		logger.error('MCQ grade error', { error });
		return json({ error: 'Failed to grade answer' }, { status: 500 });
	}
};
