import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { customTopicEnabled } from '$lib/flags';
import { generateLiveCustomTopicMcq, getQuestion } from '$lib/questions/cache.server';
import { validateQuestionRequest } from '$lib/catalog/question-request.server';
import { dev } from '$app/environment';
import { logger } from '$lib/server/logger';

/** Vercel serverless max duration (seconds); raise on Pro if AI generation exceeds default. */
export const config = {
	maxDuration: 60
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const validated = validateQuestionRequest(body);
		if (!validated.ok) return validated.response;

		const { className, unit, customTopic, excludeQuestionIds } = validated.value;

		if (customTopic && !(await customTopicEnabled())) {
			return json({ error: 'Custom topics are not available' }, { status: 403 });
		}

		const result = customTopic
			? await generateLiveCustomTopicMcq(className, customTopic)
			: await getQuestion(className, unit, { excludeQuestionIds });

		const answerStr =
			typeof result.answer === 'object' ? JSON.stringify(result.answer) : result.answer;

		return json({
			answer: answerStr,
			provider: result.provider,
			model: result.model,
			cached: result.cached ?? false,
			questionId: result.questionId
		});
	} catch (err) {
		logger.error('Generate question error', { error: err });
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to generate question', details }, { status: 500 });
	}
};
