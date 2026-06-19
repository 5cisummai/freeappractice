import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateLiveCustomTopicFrq, getCachedFRQQuestion } from '$lib/server/services/frq-cache';
import { validateQuestionRequest } from '$lib/server/question-request';
import { requireAuth } from '$lib/server/auth';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';

/** Vercel serverless max duration (seconds); FRQ generation can be slower than MCQ. */
export const config = {
	maxDuration: 60
};

export const POST: RequestHandler = async (event) => {
	try {
		const userId = await requireAuth(event);

		const body = await event.request.json();
		const validated = validateQuestionRequest(body);
		if (!validated.ok) return validated.response;

		const { className, unit, customTopic } = validated.value;

		const result = customTopic
			? await generateLiveCustomTopicFrq(className, customTopic)
			: await getCachedFRQQuestion(className, unit, userId);

		return json({
			question: result.question,
			provider: result.provider,
			model: result.model,
			cached: result.cached ?? false,
			questionId: result.questionId
		});
	} catch (err) {
		if (err instanceof Response) return err;
		logger.error('Generate FRQ question error', { error: err });
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to generate FRQ question', details }, { status: 500 });
	}
};
