import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateLiveCustomTopicMcq, getCachedQuestion } from '$lib/server/services/question-cache';
import { dev } from '$app/environment';

const MAX_CUSTOM_TOPIC_LEN = 500;

/** Vercel serverless max duration (seconds); raise on Pro if AI generation exceeds default. */
export const config = {
	maxDuration: 60
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const { className, unit, customTopic } = body;

		if (typeof className !== 'string' || !className.trim()) {
			return json(
				{ error: 'className is required and must be a non-empty string' },
				{ status: 400 }
			);
		}
		if (unit !== undefined && typeof unit !== 'string') {
			return json({ error: 'unit must be a string if provided' }, { status: 400 });
		}
		if (customTopic !== undefined && typeof customTopic !== 'string') {
			return json({ error: 'customTopic must be a string if provided' }, { status: 400 });
		}

		const topicTrim =
			typeof customTopic === 'string' ? customTopic.trim() : '';
		if (topicTrim.length > MAX_CUSTOM_TOPIC_LEN) {
			return json(
				{ error: `customTopic must be at most ${MAX_CUSTOM_TOPIC_LEN} characters` },
				{ status: 400 }
			);
		}

		const result = topicTrim
			? await generateLiveCustomTopicMcq(className.trim(), topicTrim)
			: await getCachedQuestion(className.trim(), unit ?? '', locals.userId ?? null);

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
		console.error('Generate question error:', err);
		const details = dev
			? err instanceof Error
				? err.message
				: String(err)
			: 'Internal server error';
		return json({ error: 'Failed to generate question', details }, { status: 500 });
	}
};
